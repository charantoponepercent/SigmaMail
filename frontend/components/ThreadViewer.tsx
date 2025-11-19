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
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
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
      </div>

      {/* SUBJECT BAR */}
      <div className="px-6 py-4 bg-white border-b shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 leading-tight tracking-tight">
          {sorted[sorted.length - 1].subject || "(No Subject)"}
        </h1>

        <div className="mt-2 flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 bg-blue-500 text-white text-sm px-3 py-1 rounded-full shadow-sm"
            title={sorted[sorted.length - 1].from || ""}
          >
            {(sorted[sorted.length - 1].from || "").split("<")[0].trim()}
          </span>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-12 w-full">
          {sorted.map((msg, idx) => {
            const body =
              msg.body ||
              msg.htmlBodyProcessed ||
              msg.htmlBodyRaw ||
              (msg.textBody ? `<pre>${msg.textBody}</pre>` : "");

            const { clean } = extractQuotedSections(body);

            return (
              <div key={msg._id || msg.messageId || idx}>
                <div className="flex items-start justify-between border-b pb-6 mb-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm uppercase">
                      {msg.from?.[0] || "?"}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-medium text-gray-900 truncate">
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