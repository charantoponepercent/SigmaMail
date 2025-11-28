"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  digestText: string;
  loading: boolean;
};

export default function DigestModal({ open, onClose, digestText, loading }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">AI Daily Digest</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-gray-400"></div>
              <p className="mt-3">AI is generating your daily digest…</p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {digestText || "No digest available yet."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}