/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Check, Lock } from "lucide-react";
import { format } from "date-fns";
import SecureEmailViewer from "@/components/SecureEmailViewer";
import extractQuotedSections from "@/lib/extractQuotedSections";
import AttachmentPreviewModal from "@/components/AttachmentPreviewModal";
import { useEffect, useState } from "react";
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
  const enableCollapse = sorted.length > 2;
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
            className="text-md text-gray-700 border border-gray-200 rounded-xl py-3 px-3 hover:bg-gray-100 flex items-center gap-1 transition"
          >
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="text-[12px] text-gray-600 underline underline-offset-2 hover:text-gray-900"
            >
              {detailsOpen ? "Hide Details" : "Details"}
            </button>

            {detailsOpen && (
              <div className="absolute left-0 top-full mt-2 w-[360px] max-w-[80vw] rounded-xl border border-gray-200 bg-white shadow-lg z-50">
                <div className="px-3 py-2 border-b border-gray-100 text-[11px] uppercase tracking-[0.18em] text-gray-400">
                  Details
                </div>
                <div className="max-h-64 overflow-y-auto px-3 py-3 text-[12px]">
                  <div className="grid grid-cols-[90px_1fr] gap-y-2">
                    {detailsRows.map((row) => (
                      <React.Fragment key={row.label}>
                        <p className="text-gray-500 font-medium">{row.label}:</p>
                        <p className="text-gray-800 break-all">{row.value}</p>
                      </React.Fragment>
                    ))}
                    <p className="text-gray-500 font-medium">Security:</p>
                    <p className="text-gray-800 inline-flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      {latestMessage?.security || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

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
        <div className="border-b border-gray-200 p-1 rounded-xlml bg-gray-50">
          {attachmentsOpen && (
            <div className="px-4 pb-3 pt-1">
              {/* Tabs: Images / Docs / Others */}
              <div className="flex items-center gap-2 mb-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("images")}
                  className={`px-2 py-1 rounded-full border text-xs transition-colors ${
                    activeTab === "images"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Images ({imageAttachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("docs")}
                  className={`px-2 py-1 rounded-full border text-xs transition-colors ${
                    activeTab === "docs"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Docs ({docAttachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("others")}
                  className={`px-2 py-1 rounded-full border text-xs transition-colors ${
                    activeTab === "others"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Others ({otherAttachments.length})
                </button>
              </div>

              {/* Horizontal scroll attachments list */}
              <div className="flex flex-nowrap gap-4 overflow-x-auto pb-1">
                {visibleAttachments.length === 0 ? (
                  <p className="text-[11px] text-gray-400 py-2">
                    No files in this category.
                  </p>
                ) : (
                  visibleAttachments.map((att, idx) => {
                    const isImage = att.mimeType?.startsWith("image/");
                    return (
                      <div
                        key={idx}
                        className="min-w-[160px] max-w-[180px] bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:shadow-md transition-shadow flex-shrink-0"
                        onClick={() =>
                          setPreview({
                            filename: att.filename,
                            mimeType: att.mimeType,
                            storageUrl: att.storageUrl,
                          })
                        }
                      >
                        {isImage ? (
                          <img
                            src={att.storageUrl}
                            alt={att.filename}
                            className="w-full h-28 object-cover rounded-t-md bg-gray-100"
                          />
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center bg-gray-100 rounded-t-md text-xs text-gray-600">
                              {att.mimeType?.split("/")[1]?.toUpperCase() || "FILE"}
                            </div>
                        )}
                        <div className="px-2 py-2">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[11px] font-medium text-gray-800 truncate">
                              {att.filename}
                            </p>
                            {att.isExternal && (
                              <span className="ml-1 text-[10px] text-blue-500 whitespace-nowrap">
                                &#x2601;&#x20dd;
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 truncate">
                            {att.mimeType || "Unknown"}
                          </p>
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-3xl mx-auto py-6 space-y-12 w-full">
          {sorted.map((msg, idx) => {
            // Deduplicate attachments for this message
            const uniqueMsgAttachments = Array.from(
              new Map(
                (msg.attachments || []).map(a => [
                  (a.storageUrl || "") + "-" + (a.filename || ""),
                  a
                ])
              ).values()
            );
            msg.attachments = uniqueMsgAttachments;

            const body =
              msg.body ||
              msg.htmlBodyProcessed ||
              msg.htmlBodyRaw ||
              (msg.textBody ? `<pre>${msg.textBody}</pre>` : "");

            const { clean } = extractQuotedSections(body);

            return (
              <div key={msg._id || msg.messageId || idx}>
                <div
                  className="flex items-start justify-between pb-6 mb-2 cursor-pointer transition-colors duration-200 hover:bg-gray-50 rounded-lg"
                  onClick={enableCollapse ? () => toggleMessage(idx) : undefined}
                >
                  <div className="flex gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full border border-gray-400 shadow-sm text-black flex text-md items-center justify-center">
                      {getAvatarInitial(msg.from)}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base text-[15px] font-semibold text-gray-900 truncate">
                        {msg.from?.split("<")[0]?.trim() || "Unknown"}
                      </p>
                      <p className="text-[13px] text-gray-500 truncate">
                        To: {msg.to?.split("<")[0]?.trim() || "You"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-6">
                    {enableCollapse && (
                      <div
                        className="flex flex-col items-center justify-center w-3 cursor-pointer select-none transition-transform duration-200"
                        onClick={() => toggleMessage(idx)}
                      >
                        {openMessage !== idx ? (
                          <div className="flex flex-col items-center gap-[2px] transition-all duration-200 group-hover:scale-110">
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          </div>
                        ) : (
                          <div className="w-2 h-[2px] bg-gray-500 rounded-full transition-all duration-200 group-hover:scale-110"></div>
                        )}
                      </div>
                    )}

                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {msg.date ? format(new Date(msg.date), "PPpp") : ""}
                    </span>
                  </div>
                </div>

                {(!enableCollapse || openMessage === idx) && (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-300 ease-out">
                    <div className="px-8 py-8 w-full overflow-x-hidden transition-opacity duration-300 opacity-100">
                      <div className="prose max-w-none w-full">
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mb-6 flex flex-wrap gap-4">
                            {Array.from(new Map(
                              (msg.attachments || []).map(a => [(a.storageUrl || a.filename), a])
                            ).values()).map((att, i) => {
                              const isImage = att.mimeType?.startsWith("image/");
                              return (
                                <div
                                  key={i}
                                  className="border rounded-lg p-3 bg-gray-50 w-40 shadow-sm hover:shadow cursor-pointer"
                                  onClick={() => setPreview(att)}
                                >
                                  {isImage ? (
                                    <img
                                      src={
                                        att.storageUrl ||
                                        `/api/gmail/attachment/${msg.id}/${encodeURIComponent(att.filename)}?account=${accountEmail}`
                                      }
                                      alt={att.filename}
                                      className="w-full h-28 object-cover rounded-md"
                                    />
                                  ) : (
                                    <div className="w-full h-28 flex items-center justify-center bg-white rounded-md border text-sm text-gray-500">
                                      {att.mimeType?.split("/")[1]?.toUpperCase() || "FILE"}
                                    </div>
                                  )}
                                  <p className="text-xs mt-2 font-medium text-gray-800 truncate">
                                    {att.filename}
                                  </p>
                                  {att.isExternal && (
                                    <p className="text-[10px] text-blue-500 mt-0.5">Cloud link</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <SecureEmailViewer
                          html={clean}
                          senderEmail={msg.from || ""}
                          messageId={msg.id || ""}
                          accountEmail={accountEmail}
                          attachments={msg.attachments}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {preview && (
        <AttachmentPreviewModal file={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
