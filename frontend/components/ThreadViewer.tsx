/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { format } from "date-fns";
import { X, ChevronLeft, ChevronRight, Reply, ReplyAll, Forward } from "lucide-react";
import SecureEmailViewer from "@/components/SecureEmailViewer";
import DetailsPopover from "@/components/DetailsPopover";

export default function ThreadViewer({
  thread,
  onClose,
  onPrev,
  onNext,
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

  return (
    <div className="space-y-6">
      {/* ─────────────────────────── */}
      {/* Top Toolbar & Subject */}
      {/* ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-gray-900 truncate">
          {thread.messages[0].subject || "(No Subject)"}{" "}
          <span className="text-gray-400 text-sm">
            [{thread.messages.length}]
          </span>
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            title="Previous conversation"
            className="p-2 border rounded-md hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onNext}
            title="Next conversation"
            className="p-2 border rounded-md hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 border rounded-md hover:bg-gray-50"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200" />

      {/* ─────────────────────────── */}
      {/* Threaded Messages (chat-style bubbles) */}
      {/* ─────────────────────────── */}
      {thread.messages.map((msg: any, idx: number) => {
        const isLast = idx === thread.messages.length - 1;

        return (
          <div key={msg.id} className="flex items-start gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm uppercase mt-1">
              {msg.from?.[0] || "?"}
            </div>
            {/* Bubble */}
            <div className="flex-1 max-w-[760px]">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3">
                {/* Header row */}
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
                {/* Body */}
                <div className="mt-3">
                  <SecureEmailViewer
                    html={msg.body || ""}
                    senderEmail={msg.from || ""}
                    theme="light"
                  />
                </div>
                {/* Footer (optional actions UI only) */}
                <div className="flex items-center gap-2 mt-3">
                  <button className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                    <Reply className="w-4 h-4" /> Reply
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                    <ReplyAll className="w-4 h-4" /> Reply All
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                    <Forward className="w-4 h-4" /> Forward
                  </button>
                </div>
              </div>
              {!isLast && <div className="h-3" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
