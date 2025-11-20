"use client";

import React from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import SecureEmailViewer from "@/components/SecureEmailViewer";
import extractQuotedSections from "@/lib/extractQuotedSections";

interface ThreadViewerProps {
  thread: {
    messages?: Array<{
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
    }>;
    account?: string;
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
  if (!thread?.messages?.length) return null;

  const sorted = [...thread.messages].sort(
    (a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0)
  );

  const accountEmail =
    thread.account || (sorted[0] && sorted[0].account) || "";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* TOP ACTION BAR — Zero‑style */}
      <div className="flex items-center justify-between px-4 py-3 bg-white sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 cursor-pointer hover:bg-gray-100 rounded-md">
            <X className="w-4.5 h-4.5" />
          </button>
          <button onClick={onPrev} className="p-2 cursor-pointer hover:bg-gray-100 rounded-md">
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <button onClick={onNext} className="p-2 cursor-pointer hover:bg-gray-100 rounded-md">
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* SUBJECT BAR */}
      <div className="px-6 py-4 bg-white shadow-sm">
        <h1 className="text-xl text-gray-900 leading-tight tracking-tight">
          {sorted[sorted.length - 1].subject || "(No Subject)"}
        </h1>

        <div className="mt-2 flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 bg-gray-700 text-white text-sm px-4 py-2 rounded-full shadow-sm"
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

      {/* BODY */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-3xl mx-auto py-6 space-y-12 w-full">
          {sorted.map((msg, idx) => {
            const body =
              msg.body ||
              msg.htmlBodyProcessed ||
              msg.htmlBodyRaw ||
              (msg.textBody ? `<pre>${msg.textBody}</pre>` : "");

            const { clean } = extractQuotedSections(body);

            return (
              <div key={msg._id || msg.messageId || idx}>
                <div className="flex items-start justify-between pb-6 mb-2">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gray-700 text-white flex items-center justify-center">
                      {getAvatarInitial(msg.from)}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base text-gray-900 truncate">
                        {msg.from?.split("<")[0]?.trim() || "Unknown"}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        To: {msg.to?.split("<")[0]?.trim() || "You"}
                      </p>
                    </div>
                  </div>

                  <span className="text-sm text-gray-500 whitespace-nowrap ml-6">
                    {msg.date ? format(new Date(msg.date), "PPpp") : ""}
                  </span>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-8 py-8 w-full overflow-x-hidden">
                    <div className="prose max-w-none w-full">
                      <SecureEmailViewer
                        html={clean || ""}
                        senderEmail={msg.from || ""}
                        messageId={msg.id || msg.messageId || ""}
                        accountEmail={accountEmail}
                        theme="light"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}