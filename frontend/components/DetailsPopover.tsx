/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/static-components */
"use client";
import { useState } from "react";
import { Lock } from "lucide-react";

export default function DetailsPopover({ message }: { message: any }) {
  const [open, setOpen] = useState(false);

  const Row = ({ label, value, bold }: any) =>
    value ? (
      <p className="text-[13px] text-gray-700 mb-[2px]">
        <span className="font-medium text-gray-500">{label}: </span>
        {bold ? (
          <>
            <span className="font-semibold text-gray-900">
              {value.split(" ")[0]}
            </span>{" "}
            <span className="text-gray-600">{value.split(" ").slice(1).join(" ")}</span>
          </>
        ) : (
          <span>{value}</span>
        )}
      </p>
    ) : null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="text-slate-600 hover:underline text-[13px] font-medium flex items-center gap-1"
      >
        Details
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20">
          <path fill="currentColor" d="M5 7l5 5 5-5H5z" />
        </svg>
      </button>

      {open && (
  <div className="absolute left-0 mt-1 w-[360px] bg-white rounded-xl border border-gray-200 shadow-md p-3 z-50">
    <div className="grid grid-cols-[100px_1fr] gap-y-[4px]">
      <p className="text-[13px] text-gray-500 font-medium">From:</p>
      <p className="text-[13px] text-gray-800">
        <span className="font-semibold">
          {message.from?.split("<")[0]?.trim() || "Unknown"}
        </span>{" "}
        <span className="text-gray-600">
          {message.from?.match(/<(.+)>/)?.[1] || ""}
        </span>
      </p>

      <p className="text-[13px] text-gray-500 font-medium">To:</p>
      <p className="text-[13px] text-gray-800">{message.to || "-"}</p>

      <p className="text-[13px] text-gray-500 font-medium">Reply To:</p>
      <p className="text-[13px] text-gray-800">{message.replyTo || "-"}</p>

      <p className="text-[13px] text-gray-500 font-medium">Date:</p>
      <p className="text-[13px] text-gray-800">{message.date || "-"}</p>

      <p className="text-[13px] text-gray-500 font-medium">Mailed-By:</p>
      <p className="text-[13px] text-gray-800">{message.mailedBy || "-"}</p>

      <p className="text-[13px] text-gray-500 font-medium">Signed-By:</p>
      <p className="text-[13px] text-gray-800">{message.signedBy || "-"}</p>

      <p className="text-[13px] text-gray-500 font-medium">Security:</p>
      <p className="text-[13px] text-gray-800 flex items-center">
        <Lock className="w-3.5 h-3.5 text-green-600 mr-1" />
        <span>{message.security || "—"}</span>
      </p>
    </div>
  </div>
)}

    </div>
  );
}
