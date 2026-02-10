"use client";

import EmailListItem from "./EmailListItem";
import { Loader2 } from "lucide-react";
import { DashboardMessage } from "../types";

type Props = {
  messages: DashboardMessage[];
  loadingMessages: boolean;
  searchLoading: boolean;
  selectedThreadId: string | null;
  openMessage: (id: string) => void;

  cleanSubject: (s: string) => string;
  getAvatarInitial: (from: string) => string;
  formatDate: (date?: string) => string;

  selectedAccount: string | null;
};

export default function EmailList({
  messages,
  loadingMessages,
  searchLoading,
  selectedThreadId,
  openMessage,

  cleanSubject,
  getAvatarInitial,
  formatDate,

  selectedAccount,
}: Props) {
  return (
    <div className="flex-1 p-2 overflow-y-auto space-y-2">
      {/* 🔵 Search Loading */}
      {searchLoading && (
        <div className="p-7 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* 🟣 Inbox Loading */}
      {loadingMessages && (
        <div className="p-7 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-800" />
        </div>
      )}

      {/* 🟡 Loaded */}
      {!loadingMessages && (
        <>
          {!selectedAccount ? (
            <p className="p-4 text-gray-500 text-sm">Select an account</p>
          ) : messages.filter((m) => !m.hidden).length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No messages found</p>
          ) : (
            messages
              .filter((msg) => !msg.hidden)
              .map((msg) => {
                const id = msg.threadId || msg._id || msg.id;

                return (
                  <EmailListItem
                    key={id}
                    msg={msg}
                    selected={selectedThreadId === id}
                    onClick={() => openMessage(id)}
                    cleanSubject={cleanSubject}
                    getAvatarInitial={getAvatarInitial}
                    formatDate={formatDate}
                  />
                );
              })
          )}
        </>
      )}
    </div>
  );
}
