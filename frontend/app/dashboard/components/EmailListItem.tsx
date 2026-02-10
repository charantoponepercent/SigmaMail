/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import { useEffect, useState } from "react";

import { Paperclip } from "lucide-react";
import { CATEGORY_BADGE_CLASS } from "./utils/categories";
import { DashboardMessage } from "../types";

type Props = {
  msg: DashboardMessage;
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
    if (!showNew || !msg.createdAt) return;
    const createdAtMs = new Date(msg.createdAt).getTime();

    const remaining =
      2 * 60 * 1000 -
      (Date.now() - createdAtMs);

    if (remaining <= 0) {
      setShowNew(false);
      return;
    }

    const t = setTimeout(() => setShowNew(false), remaining);
    return () => clearTimeout(t);
  }, [showNew, msg.createdAt]);

  const formatActionDate = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

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
            {msg.needsReply && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-sky-700 bg-sky-100 rounded-full flex-shrink-0">
                Needs Reply
              </span>
            )}
            {msg.hasDeadline && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full flex-shrink-0">
                {msg.deadlineAt ? `Deadline ${formatActionDate(msg.deadlineAt)}` : "Deadline"}
              </span>
            )}
            {msg.isOverdueFollowUp && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-rose-700 bg-rose-100 rounded-full flex-shrink-0">
                Overdue Follow-up
              </span>
            )}
            {!msg.isOverdueFollowUp && msg.isFollowUp && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 rounded-full flex-shrink-0">
                Follow-up
              </span>
            )}
            {typeof msg.searchScore === "number" && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-100 rounded-full flex-shrink-0">
                Match {Math.round(msg.searchScore * 100)}%
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
          {(msg.unreadCount ?? 0) > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-blue-700">
              {msg.unreadCount ?? 0}
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
            className={`px-2 py-1.5 text-[10px] font-medium rounded-2xl ${CATEGORY_BADGE_CLASS[msg.category || "General"] || CATEGORY_BADGE_CLASS.General}`}
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
