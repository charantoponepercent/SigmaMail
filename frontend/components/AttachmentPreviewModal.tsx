"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface AttachmentPreviewModalProps {
  file: {
    filename: string;
    mimeType: string;
    storageUrl?: string;
  } | null;
  onClose: () => void;
}

export default function AttachmentPreviewModal({
  file,
  onClose,
}: AttachmentPreviewModalProps) {
  // Close modal on ESC
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  if (!file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* STOP PROPAGATION */}
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-white/80 hover:bg-white/100 shadow p-2 rounded-full"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* CONTENT AREA */}
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          {/* IMAGE PREVIEW */}
          {isImage && (
            <img
              src={file.storageUrl}
              alt={file.filename}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          )}

          {/* PDF PREVIEW */}
          {isPDF && (
            <iframe
              src={file.storageUrl}
              className="w-full h-[85vh] rounded-lg"
            />
          )}

          {/* OTHER FILES */}
          {!isImage && !isPDF && (
            <div className="p-10 text-center">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-lg font-medium">{file.filename}</p>
              <a
                href={file.storageUrl}
                download
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
              >
                Download
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ANIMATION */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}