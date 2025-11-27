// app/dashboard/components/layout/SearchCommandPalette.tsx
"use client";
import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function SearchCommandPalette({ open, onClose, onSearchChange }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[480px] mt-24 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          placeholder="Search anything…"
          className="w-full px-4 py-3 rounded-xl bg-white/70 backdrop-blur border border-white/40 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          onChange={onSearchChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") onClose();
          }}
        />

        <div className="mt-4 space-y-1 text-sm text-gray-700">
          <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
            🔍 Search emails
          </div>
          <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
            👤 Search senders
          </div>
          <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
            📎 Find attachments
          </div>
          <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
            ⚙️ Open settings
          </div>
        </div>
      </div>
    </div>
  );
}