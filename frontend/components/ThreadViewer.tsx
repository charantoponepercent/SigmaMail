/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Check,
  Lock,
  Paperclip,
  ImageIcon,
  FileText,
  FileSpreadsheet,
  File,
} from "lucide-react";
import { format } from "date-fns";
import SecureEmailViewer from "@/components/SecureEmailViewer";
import extractQuotedSections from "@/lib/extractQuotedSections";
import AttachmentPreviewModal from "@/components/AttachmentPreviewModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORY_BADGE_CLASS, CATEGORY_OPTIONS } from "@/app/dashboard/components/utils/categories";

interface ThreadAttachment {
  filename: string;
  mimeType: string;
  storageUrl?: string;
  messageId?: string;
  emailId?: string;
  isExternal?: boolean;
  provider?: string;
}

interface ThreadEmail {
  attachments?: { filename: string; mimeType: string; storageUrl?: string; isExternal?: boolean; provider?: string }[];
  _id?: string;
  messageId?: string;
  id?: string;
  threadId?: string;
  date?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject?: string;
  category?: string;
  body?: string;
  htmlBodyProcessed?: string;
  htmlBodyRaw?: string;
  textBody?: string;
  account?: string;
  mailedBy?: string;
  signedBy?: string;
  security?: string;
  headers?: Record<string, string>;
  needsReply?: boolean;
  needsReplyScore?: number;
  needsReplyReason?: string;
  hasDeadline?: boolean;
  deadlineAt?: string;
  deadlineConfidence?: number;
  isFollowUp?: boolean;
  followUpWaitingSince?: string;
  isOverdueFollowUp?: boolean;
}

interface ThreadViewerProps {
  thread: {
    messages?: ThreadEmail[];
    attachments?: ThreadAttachment[];
    account?: string;
    threadId?: string;
  };
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCategoryFeedback: (emailId: string, category: string) => Promise<void> | void;
}

function getAvatarInitial(fromField?: string): string {
  if (!fromField || typeof fromField !== "string") return "M";

  // Extract name before <email>
  let name = fromField.split("<")[0].trim();

  // Remove quotes: "TaTT" → TaTT
  name = name.replace(/["']/g, "");

  // Find the first alphabetical character only
  const match = name.match(/[A-Za-z]/);
  if (match) return match[0].toUpperCase();

  // If no name available, fallback to email local-part
  const emailMatch = fromField.match(/^([^@]+)/);
  if (emailMatch && emailMatch[1]) {
    const emailInitial = emailMatch[1].match(/[A-Za-z]/);
    if (emailInitial) return emailInitial[0].toUpperCase();
  }

  // Default fallback
  return "M";
}

function extractPrimaryEmail(value = ""): string {
  const angle = value.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  const plain = value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/);
  return plain?.[0] || "";
}

export default function ThreadViewer({ thread, onClose, onPrev, onNext, onCategoryFeedback }: ThreadViewerProps) {
  type Attachment = {
    filename: string;
    mimeType: string;
    storageUrl?: string;
    isExternal?: boolean;
    provider?: string;
  };
  
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [openMessage, setOpenMessage] = useState<number | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"images" | "docs" | "others">("images");
  const [savingCategory, setSavingCategory] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPosition, setDetailsPosition] = useState({ top: 0, left: 0 });
  const detailsButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const toggleMessage = (index: number) => {
    setOpenMessage(prev => (prev === index ? null : index));
  };

  if (!thread?.messages?.length) return null;

  // 🔥 Deduplicate attachments by URL or filename (global thread-level dedupe)
  const rawThreadAttachments: ThreadAttachment[] = thread.attachments || [];

  const threadAttachmentsMap = new Map();
  rawThreadAttachments.forEach(att => {
    const key = att.storageUrl || att.filename;
    if (!threadAttachmentsMap.has(key)) {
      threadAttachmentsMap.set(key, att);
    }
  });
  const threadAttachments: ThreadAttachment[] = Array.from(threadAttachmentsMap.values());
  const hasThreadAttachments = threadAttachments.length > 0;

  // Filter images but exclude inline Gmail-referenced images with no useful URL
  const imageAttachments = threadAttachments.filter((att) =>
    att.mimeType?.startsWith("image/") &&
    att.storageUrl &&
    !att.storageUrl.includes("data:image")
  );

  const docAttachments = threadAttachments.filter((att) => {
    const mt = att.mimeType || "";
    return (
      mt.includes("pdf") ||
      mt.includes("word") ||
      mt.includes("officedocument") ||
      mt.includes("sheet") ||
      mt.includes("excel") ||
      mt.includes("presentation") ||
      mt.includes("powerpoint") ||
      mt.includes("text")
    );
  });

  const otherAttachments = threadAttachments.filter(
    (att) =>
      !imageAttachments.includes(att) && !docAttachments.includes(att)
  );

  // 🚫 Prevent duplicates leaking into visible category listings
  const visibleAttachments = Array.from(
    new Map(
      (
        activeTab === "images"
          ? imageAttachments
          : activeTab === "docs"
          ? docAttachments
          : otherAttachments
      ).map(a => [
        (a.storageUrl || "") + "-" + (a.filename || ""),
        a
      ])
    ).values()
  );

  const sorted = [...thread.messages].sort(
    (a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0)
  );
  const enableCollapse = sorted.length > 1;
  const latestMessage = sorted[sorted.length - 1];
  const latestMessageId = latestMessage?._id || latestMessage?.id || latestMessage?.messageId;
  const threadCategory = latestMessage?.category || "General";

  const accountEmail =
    thread.account || (sorted[0] && sorted[0].account) || "";

  const applyCategoryFromThread = async (category: string) => {
    if (!latestMessageId || savingCategory) return;
    setSavingCategory(true);
    try {
      await onCategoryFeedback(latestMessageId, category);
    } finally {
      setSavingCategory(false);
    }
  };

  const formatDetailsDate = (value?: string) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "MMM d, yyyy, h:mm:ss a");
    } catch {
      return value;
    }
  };

  const inferredMailedBy = latestMessage?.mailedBy || extractPrimaryEmail(latestMessage?.from || "");
  const inferredSignedBy = latestMessage?.signedBy || (
    inferredMailedBy.includes("@") ? inferredMailedBy.split("@")[1] : ""
  );

  const formatSignalDeadline = (value?: string) => {
    if (!value) return "";
    try {
      return format(new Date(value), "MMM d, h:mm a");
    } catch {
      return value;
    }
  };

  const signalBadges = [
    latestMessage?.needsReply
      ? {
          label: "Needs Reply",
          className: "bg-sky-100 text-sky-700 border-sky-200",
        }
      : null,
    latestMessage?.hasDeadline
      ? {
          label: latestMessage?.deadlineAt
            ? `Deadline ${formatSignalDeadline(latestMessage.deadlineAt)}`
            : "Deadline",
          className: "bg-amber-100 text-amber-800 border-amber-200",
        }
      : null,
    latestMessage?.isOverdueFollowUp
      ? {
          label: "Overdue Follow-up",
          className: "bg-rose-100 text-rose-700 border-rose-200",
        }
      : latestMessage?.isFollowUp
      ? {
          label: "Follow-up",
          className: "bg-emerald-100 text-emerald-700 border-emerald-200",
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; className: string }>;

  const detailsRows = [
    { label: "From", value: latestMessage?.from || "—" },
    { label: "To", value: latestMessage?.to || "—" },
    { label: "Date", value: formatDetailsDate(latestMessage?.date) },
    { label: "Mailed-By", value: inferredMailedBy || "—" },
    { label: "Signed-By", value: inferredSignedBy || "—" },
    { label: "Message-ID", value: latestMessage?.messageId || latestMessage?.id || "—" },
  ];

  useEffect(() => {
    setDetailsOpen(false);
  }, [latestMessageId]);

  useEffect(() => {
    if (!enableCollapse) {
      setOpenMessage(null);
      return;
    }
    setOpenMessage(sorted.length - 1);
  }, [enableCollapse, latestMessageId, sorted.length, thread.threadId]);

  const getPreviewText = (primarySource: string, fallbackSource?: string) => {
    const raw = primarySource || fallbackSource || "";
    if (!raw) return "No new message content.";

    const dequoted = extractQuotedSections(raw).clean;
    const textOnly = dequoted
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const normalized = textOnly
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(from|to|cc|bcc|subject|date|sent):\s/i.test(line))
      .filter((line) => !/^-{2,}\s*forwarded message\s*-{2,}$/i.test(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return "No new message content.";
    return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
  };

  const getAttachmentTypeLabel = (filename = "", mimeType = "") => {
    const fromName = filename.includes(".") ? filename.split(".").pop() : "";
    if (fromName) return fromName.toUpperCase();
    const subtype = mimeType.split("/")[1];
    return (subtype || "FILE").toUpperCase();
  };

  const getAttachmentIcon = (mimeType = "") => {
    const mt = mimeType.toLowerCase();
    if (mt.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-indigo-600" />;
    if (mt.includes("sheet") || mt.includes("csv") || mt.includes("excel")) {
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    }
    if (
      mt.includes("pdf") ||
      mt.includes("text") ||
      mt.includes("word") ||
      mt.includes("officedocument")
    ) {
      return <FileText className="h-4 w-4 text-amber-600" />;
    }
    return <File className="h-4 w-4 text-slate-500" />;
  };

  const calculateDetailsPosition = useCallback(() => {
    if (typeof window === "undefined" || !detailsButtonRef.current) {
      return { top: 0, left: 0 };
    }

    const margin = 12;
    const popoverWidth = Math.min(380, window.innerWidth - margin * 2);
    const estimatedHeight = 320;
    const rect = detailsButtonRef.current.getBoundingClientRect();

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    left = Math.max(margin, left);

    let top = rect.bottom + 10;
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estimatedHeight - 10);
    }

    return { top, left };
  }, []);

  const toggleDetails = () => {
    if (detailsOpen) {
      setDetailsOpen(false);
      return;
    }
    setDetailsPosition(calculateDetailsPosition());
    setDetailsOpen(true);
  };

  useEffect(() => {
    if (!detailsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (detailsPanelRef.current?.contains(target)) return;
      if (detailsButtonRef.current?.contains(target)) return;
      setDetailsOpen(false);
    };

    const syncPosition = () => {
      setDetailsPosition(calculateDetailsPosition());
    };

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [calculateDetailsPosition, detailsOpen]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* SUBJECT BAR */}
      <div className="flex items-center px-3 py-1 bg-white sticky top-0 z-40 gap-3">

        {/* ACTION BUTTONS */}
        <div className="flex border rounded-xl p-1 items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 cursor-pointer rounded-md">
            <X className="w-4 h-4" />
          </button>
          <button onClick={onPrev} className="p-2 hover:bg-gray-100 cursor-pointer rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onNext} className="p-2 hover:bg-gray-100 cursor-pointer rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ATTACHMENTS */}
        {hasThreadAttachments && (
          <button
            type="button"
            onClick={() => setAttachmentsOpen((prev) => !prev)}
            className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            <Paperclip className="h-4 w-4 text-slate-500 transition group-hover:text-slate-700" />
            <span>Attachments ({threadAttachments.length})</span>
            <ChevronRightIcon
              className={`w-4 h-4 transition-transform duration-200 ${
                attachmentsOpen ? "rotate-90" : ""
              }`}
            />
          </button>
        )}
      </div>        


      {/* SUBJECT BAR */}
      <div className="px-4 py-4 bg-white shadow-sm space-y-2">
        <h1 className="text-xl font-semibold text-gray-900 leading-tight tracking-tight">
          {sorted[sorted.length - 1].subject || "(No Subject)"}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 text-[12px] border text-black px-2 py-1 rounded-full"
            title={latestMessage?.from || ""}
          >
            {(() => {
              const raw =
                (latestMessage?.from || "")
                  .split("<")[0]
                  .trim()
                  .replace(/["']/g, ""); // remove quotes

              const initial = raw[0]?.toUpperCase() || "U";

              return (
                <>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                    {initial}
                  </span>

                  {raw}
                </>
              );
            })()}
          </span>

          <span
            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-medium rounded-full ${CATEGORY_BADGE_CLASS[threadCategory] || CATEGORY_BADGE_CLASS.General}`}
          >
            {threadCategory}
          </span>

          {signalBadges.map((badge) => (
            <span
              key={badge.label}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}

          <button
            ref={detailsButtonRef}
            type="button"
            onClick={toggleDetails}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? "Hide message details" : "Show message details"}
          >
            Details
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>

          {latestMessageId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={savingCategory}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {savingCategory ? "Saving..." : "Correct Category"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
                  Mark this thread as
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CATEGORY_OPTIONS.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => applyCategoryFromThread(cat)}
                    className="cursor-pointer"
                  >
                    <span className="text-sm">{cat}</span>
                    {cat === threadCategory && (
                      <Check className="ml-auto h-4 w-4 text-emerald-600" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        

      </div>

      {/* THREAD-LEVEL ATTACHMENTS BAR (collapsible, grouped) */}
      {hasThreadAttachments && (
        <div className="border-b border-slate-200 bg-white px-4 pb-4 pt-2">
          {attachmentsOpen && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Thread Attachments</p>
                  <p className="text-xs text-slate-500">
                    {visibleAttachments.length} shown from {threadAttachments.length} total
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {activeTab === "images" ? "Image files" : activeTab === "docs" ? "Documents" : "Other files"}
                </span>
              </div>

              <div className="mt-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("images")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    activeTab === "images"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Images ({imageAttachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("docs")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    activeTab === "docs"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Docs ({docAttachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("others")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    activeTab === "others"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Others ({otherAttachments.length})
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAttachments.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-slate-700">No files in this bucket</p>
                    <p className="mt-1 text-xs text-slate-500">Switch tabs to view other attachment types.</p>
                  </div>
                ) : (
                  visibleAttachments.map((att, idx) => {
                    const isImage = att.mimeType?.startsWith("image/");
                    return (
                      <div
                        key={idx}
                        className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                        onClick={() =>
                          setPreview({
                            filename: att.filename,
                            mimeType: att.mimeType,
                            storageUrl: att.storageUrl,
                          })
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                              {isImage && att.storageUrl ? (
                                <img
                                  src={att.storageUrl}
                                  alt={att.filename}
                                  className="h-8 w-8 rounded-md object-cover"
                                />
                              ) : (
                                getAttachmentIcon(att.mimeType)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-800">
                                {att.filename}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {att.mimeType || "Unknown format"}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {getAttachmentTypeLabel(att.filename, att.mimeType)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-blue-600 group-hover:text-blue-700">
                            Open preview
                          </span>
                          {att.isExternal && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              Cloud
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* BODY */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/60 via-white to-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
          <div className="relative space-y-4">
            {enableCollapse && (
              <div className="pointer-events-none absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200" />
            )}
            {sorted.map((msg, idx) => {
              const body =
                msg.body ||
                msg.htmlBodyProcessed ||
                msg.htmlBodyRaw ||
                (msg.textBody ? `<pre>${msg.textBody}</pre>` : "");

              const { clean } = extractQuotedSections(body);
              const isOpen = !enableCollapse || openMessage === idx;
              const isLatest = idx === sorted.length - 1;
              const senderName = msg.from?.split("<")[0]?.trim() || "Unknown";
              const receiverName = msg.to?.split("<")[0]?.trim() || "You";
              const previewText = getPreviewText(clean, msg.textBody || msg.body);

              return (
                <article
                  key={msg._id || msg.messageId || idx}
                  className={`relative ${enableCollapse ? "pl-11" : ""}`}
                >
                  {enableCollapse && (
                    <span
                      className={`absolute left-[10px] top-6 h-[14px] w-[14px] rounded-full border-2 transition-all ${
                        isOpen
                          ? "border-blue-500 bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.16)]"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                  )}
                  <div
                    className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                      isOpen
                        ? "border-slate-300 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.1)]"
                        : "border-slate-200/80 bg-slate-50/90 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full px-4 py-3.5 text-left sm:px-5 sm:py-4"
                      onClick={enableCollapse ? () => toggleMessage(idx) : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                              isOpen
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            {getAvatarInitial(msg.from)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[18px] font-semibold leading-tight text-slate-900">
                                {senderName}
                              </p>
                              {isLatest && (
                                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">
                                  Latest
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[13px] text-slate-500">
                              To: {receiverName}
                            </p>
                            {enableCollapse && !isOpen && (
                              <p className="mt-2 text-[13px] leading-5 text-slate-600">
                                {previewText}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="whitespace-nowrap text-[13px] font-medium text-slate-500">
                            {msg.date ? format(new Date(msg.date), "PPp") : ""}
                          </span>
                          {enableCollapse && (
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                isOpen ? "rotate-180 text-slate-700" : "text-slate-400"
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
                        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
                          <SecureEmailViewer
                            html={clean}
                            senderEmail={msg.from || ""}
                            messageId={msg.id || ""}
                            accountEmail={accountEmail}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      {preview && (
        <AttachmentPreviewModal file={preview} onClose={() => setPreview(null)} />
      )}
      {detailsOpen && (
        <div className="fixed inset-0 z-[70] bg-transparent pointer-events-none">
          <div
            ref={detailsPanelRef}
            style={{
              top: detailsPosition.top,
              left: detailsPosition.left,
              width: "min(380px, calc(100vw - 24px))",
            }}
            className="pointer-events-auto absolute rounded-2xl border border-slate-200 bg-white/95 shadow-[0_16px_48px_rgba(15,23,42,0.16)] backdrop-blur-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Message Details</p>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close message details"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-[62vh] overflow-y-auto px-4 py-3 text-[12px]">
              <div className="grid grid-cols-[95px_1fr] gap-y-2.5">
                {detailsRows.map((row) => (
                  <React.Fragment key={row.label}>
                    <p className="text-slate-500 font-medium">{row.label}:</p>
                    <p className="text-slate-800 break-all">{row.value}</p>
                  </React.Fragment>
                ))}
                <p className="text-slate-500 font-medium">Security:</p>
                <p className="text-slate-800 inline-flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  {latestMessage?.security || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
