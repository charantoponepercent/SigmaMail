/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { format } from "date-fns";
import SecureEmailViewer from "@/components/SecureEmailViewer";
import extractQuotedSections from "@/lib/extractQuotedSections";
import AttachmentPreviewModal from "@/components/AttachmentPreviewModal";
import { useState } from "react";

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
  attachments: { filename: string; mimeType: string; storageUrl?: string; isExternal?: boolean; provider?: string }[];
  _id?: string;
  messageId?: string;
  id?: string;
  date?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  htmlBodyProcessed?: string;
  htmlBodyRaw?: string;
  textBody?: string;
  account?: string;
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

export default function ThreadViewer({ thread, onClose, onPrev, onNext }: ThreadViewerProps) {
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


  const accountEmail =
    thread.account || (sorted[0] && sorted[0].account) || "";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* SUBJECT BAR */}
      <div className="flex items-center px-3 py-1 bg-white sticky top-0 z-40 gap-3">

        {/* ACTION BUTTONS */}
        <div className="flex border rounded-xl p-1 items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
          <button onClick={onPrev} className="p-2 hover:bg-gray-100 rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onNext} className="p-2 hover:bg-gray-100 rounded-md">
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
      <div className="px-4 py-4 bg-white shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 leading-tight tracking-tight">
          {sorted[sorted.length - 1].subject || "(No Subject)"}
        </h1>

        <div className="mt-2 flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 text-[12px] border text-black px-2 py-1 rounded-full"
            title={sorted[sorted.length - 1].from || ""}
          >
            {(() => {
              const raw =
                (sorted[sorted.length - 1].from || "")
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