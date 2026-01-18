/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useState } from "react";

import { Paperclip } from "lucide-react";

type Props = {
  msg: any;
  selected: boolean;
  onClick: () => void;
  cleanSubject: (s?: string) => string;
  getAvatarInitial: (f?: string) => string;
  formatDate: (d?: string) => string;
};

export default function EmailListItem({
  msg,
  selected,
  onClick,
  cleanSubject,
  getAvatarInitial,
  formatDate,
}: Props) {
  const [showNew, setShowNew] = useState(() => {
    if (!msg?.createdAt) return false;
    const created = new Date(msg.createdAt).getTime();
    return Date.now() - created < 2 * 60 * 1000; // 2 minutes
  });

  useEffect(() => {
    if (!showNew) return;

    const remaining =
      2 * 60 * 1000 -
      (Date.now() - new Date(msg.createdAt).getTime());

    if (remaining <= 0) {
      setShowNew(false);
      return;
    }

    const t = setTimeout(() => setShowNew(false), remaining);
    return () => clearTimeout(t);
  }, [showNew, msg.createdAt]);

  return (
    <div
      key={msg.threadId || msg.id}
      onClick={onClick}
      data-thread-id={msg.threadId || msg.id}
      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all rounded-lg ${
        selected
          ? "bg-gray-100 border border-gray-100"
          : "bg-white border-l-transparent hover:bg-gray-50 hover:border-l-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Avatar */}
      <div className="w-10 h-10 flex-shrink-0 rounded-full border border-gray-300 text-black flex items-center justify-center text-sm font-semibold uppercase shadow-sm">
        {getAvatarInitial(msg.from)}
      </div>

      {/* Content */}
      <div className="flex-1 truncate min-w-0">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3
              className={`text-[14px] truncate ${
                msg.isRead === false
                  ? "font-semibold text-gray-900"
                  : "font-medium text-gray-700"
              }`}
            >
              {msg.from?.split("<")[0].trim() || "Unknown Sender"}
            </h3>
            {showNew && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-600 text-white flex-shrink-0">
                NEW
              </span>
            )}
            {msg.priority && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-purple-700 bg-purple-100 rounded-full flex-shrink-0">
                Priority
              </span>
            )}
            {msg.billDue && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-orange-700 bg-orange-100 rounded-full flex-shrink-0">
                Bill Due
              </span>
            )}
          </div>

          {(msg.threadAttachmentCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-300 text-gray-700 rounded-full shadow-sm text-[11px] font-medium mr-2">
              📎 {msg.threadAttachmentCount}
            </div>
          )}

          <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
            {formatDate(msg.date)}
          </span>
          {msg.unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-blue-700">
              {msg.unreadCount}
            </span>
          )}

          {(msg.unreadCount ?? 0) > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0"
                title="Unread"
              />
            )}
        </div>

        {/* Subject */}
        <p
          className={`text-[12px] truncate mb-1 ${
            msg.isRead === false
              ? "font-semibold text-gray-800"
              : "font-medium text-gray-500"
          }`}
        >
          {cleanSubject(msg.subject)}
        </p>

        {/* Footer Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category badge */}
          <span
            className={`px-2 py-1.5 text-[10px] font-medium rounded-2xl ${
              msg.category === "Work"
                ? "bg-blue-100 text-blue-700"
                : msg.category === "Finance"
                ? "bg-green-100 text-green-700"
                : msg.category === "Bills"
                ? "bg-orange-100 text-orange-700"
                : msg.category === "Personal"
                ? "bg-purple-100 text-purple-700"
                : msg.category === "Travel"
                ? "bg-cyan-100 text-cyan-700"
                : msg.category === "Promotions"
                ? "bg-pink-100 text-pink-700"
                : msg.category === "Updates"
                ? "bg-gray-100 text-gray-700"
                : msg.category === "Social"
                ? "bg-yellow-100 text-yellow-700"
                : msg.category === "Shopping"
                ? "bg-emerald-100 text-emerald-700"
                : msg.category === "Priority"
                ? "bg-red-100 text-red-700"
                : msg.category === "Spam"
                ? "bg-red-200 text-red-900"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {msg.category || "General"}
          </span>

          {/* Account label */}
          <div className="flex items-center gap-1.5 text-xs rounded-xl bg-gray-50 border px-3 py-1 text-gray-500">
            <span className="w-1 h-1 rounded-full bg-purple-500"></span>
            <span className="max-w-[200px] truncate">
              {(() => {
                const raw = (msg.accountEmail || msg.to || "").replace(/"/g, "");

                // 1) Try to extract <email>
                const angleMatch = raw.match(/<([^>]+)>/);
                if (angleMatch) return angleMatch[1];

                // 2) Try to extract plain email
                const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) return emailMatch[0];

                return "Unknown";
              })()}
            </span>
          </div>

          {/* Attachments */}
          {(msg.attachments?.length ?? 0) > 0 && (
            <div className="p-1.5 rounded-full bg-purple-100 flex items-center justify-center">
              <Paperclip className="w-3 h-3 text-purple-600" />
            </div>
          )}

          {/* Starred */}
          {msg.starred && (
            <svg
              className="w-4 h-4 text-yellow-500 fill-current ml-auto"
              viewBox="0 0 20 20"
            >
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}