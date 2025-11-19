/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import { format } from "date-fns";
import { X, ChevronLeft, ChevronRight, Reply, ReplyAll, Forward } from "lucide-react";
import SecureEmailViewer from "@/components/SecureEmailViewer";
import DetailsPopover from "@/components/DetailsPopover";

function extractQuotedSections(html: string) {
  if (!html) return { clean: "", quotes: [] as string[] };

  let working = html;

  const quotes: string[] = [];

  // 1) Extract common Gmail quoted wrapper
  // capture <div class="gmail_quote"> ... </div>
  const gmailQuoteRegex = /<div[^>]*class=["'][^"'>]*gmail_quote[^"'>]*["'][^>]*>[\s\S]*?<\/div>/gi;
  working = working.replace(gmailQuoteRegex, (m) => {
    quotes.push(m);
    return "";
  });

  // 2) Extract blockquote sections (Outlook, replies)
  const blockquoteRegex = /<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi;
  working = working.replace(blockquoteRegex, (m) => {
    quotes.push(m);
    return "";
  });

  // 3) Extract forwarded "On DATE, X wrote:" lines and everything after (heuristic)
  // We'll try to capture "On <date>, <name> wrote:" and subsequent content
  const onWroteRegex = /On\s.+?wrote:([\s\S]*)/gi;
  working = working.replace(onWroteRegex, (m, g1) => {
    quotes.push(g1 || m);
    return "";
  });

  // 4) Remove common > quoted lines from plaintext
  working = working.replace(/(^|\n)[ \t]*>[^\n]*/g, "");

  // Trim whitespace
  working = working.trim();

  return { clean: working, quotes };
}

export default function ThreadViewer({
  thread,
  onClose,
  onPrev,
  onNext,
  // expect parent to pass accountEmail via context or prop; fallback to empty
}: {
  thread: any;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  if (!thread?.messages?.length) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 italic">
        No messages in this thread
      </div>
    );
  }

  // sort ascending (oldest -> newest)
  const sorted = useMemo(() => {
    const copy = [...thread.messages];
    copy.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return ta - tb;
    });
    return copy;
  }, [thread]);

  // try to get accountEmail from thread or from global (if available)
  const accountEmail = (thread.account || (thread.messages[0] && thread.messages[0].account)) || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
  {/* Subject Header */}
  <div className="px-6 py-4 border-b border-gray-200 bg-white">
    <h2 className="text-xl font-semibold text-gray-900 line-clamp-2 pr-32">
      {sorted[sorted.length - 1].subject || "(No Subject)"}
      <span className="text-gray-400 text-sm font-normal ml-2">
        [{sorted.length}]
      </span>
    </h2>
  </div>

  {/* Floating Action Buttons - Top Right */}
  <div className="absolute top-4 right-6 flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
    <button 
      onClick={onPrev}
      title="Previous"
      className="p-3 hover:bg-gray-100 rounded-md transition-colors"
    >
      <ChevronLeft className="w-4.5 h-4.5 text-gray-600" />
    </button>
    <button 
      onClick={onNext}
      title="Next"
      className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
    >
      <ChevronRight className="w-4.5 h-4.5 text-gray-600" />
    </button>
    <div className="w-px h-5 bg-gray-200" />
    <button 
      onClick={onClose}
      title="Close"
      className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
    >
      <X className="w-4.5 h-4.5 text-gray-600" />
    </button>
  </div>
</div>


      {/* messages */}
      {sorted.map((msg: any, idx: number) => {
        const isLast = idx === sorted.length - 1;
        const rawBody =
        msg.body ||
        msg.htmlBodyProcessed ||
        msg.htmlBodyRaw ||
        (msg.textBody ? `<pre>${msg.textBody}</pre>` : "");

      const { clean, quotes } = extractQuotedSections(rawBody);

        return (
          <div
            key={`${msg.threadId || 't'}-${msg._id || msg.messageId || msg.id || idx}`}
            className="flex items-start gap-3"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm uppercase mt-1">
              {msg.from?.[0] || "?"}
            </div>

            {/* Bubble */}
            <div className="flex-1 max-w-[760px]">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {msg.from?.split("<")[0]?.trim() || "Unknown"}
                      </p>
                      <DetailsPopover message={msg} />
                    </div>
                    <p className="text-[12px] text-gray-500">
                      To: {msg.to?.split("<")[0]?.trim() || "You"}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap ml-3">
                    {msg.date ? format(new Date(msg.date), "MMM d, h:mm a") : ""}
                  </span>
                </div>

                {/* Body (clean version) */}
                <div className="mt-3">
                  <SecureEmailViewer
                    html={clean || ""}
                    senderEmail={msg.from || ""}
                    messageId={msg.id}
                    accountEmail={accountEmail}
                    theme="light"
                  />
                </div>

                {/* quoted collapsible
                {quotes.length > 0 && (
                  <details className="mt-3" data-quoted>
                    <summary className="text-sm text-gray-500 cursor-pointer hover:underline">
                      Show quoted text
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-100">
                      {quotes.map((q, i) => (
                        <div key={i} className="mb-3">
                          <SecureEmailViewer
                            html={q}
                            senderEmail={msg.from || ""}
                            messageId={`${msg.id}-quote-${i}`}
                            accountEmail={accountEmail}
                            theme="light"
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                )} */}

                {/* <div className="flex items-center gap-2 mt-3">
                  <button className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                    <ReplyAll className="w-3.5 h-3.5" /> Reply All
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                    <Forward className="w-3.5 h-3.5" /> Forward
                  </button>
                </div> */}
              </div>

              {!isLast && <div className="h-3" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}