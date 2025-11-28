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
      <div className="bg-white rounded-2xl shadow-2xl w-[650px] max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
          <h2 className="text-lg font-bold tracking-wide">AI Daily Digest</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium">Crafting your smart daily digest…</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* IMPORTANT SECTION */}
              {digestText?.important && Array.isArray(digestText.important) && (
                <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-500">❗</span>
                    <h3 className="text-md font-semibold text-gray-900">Important</h3>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                    {digestText.important.map((i: string, idx: number) => (
                      <li key={idx} className="font-medium">{i}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* MEETINGS SECTION */}
              {digestText?.meetings && Array.isArray(digestText.meetings) && digestText.meetings.length > 0 && (
                <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600">📅</span>
                    <h3 className="text-md font-semibold text-gray-900">Meetings</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {digestText.meetings.map((m: any, idx: number) => (
                      <li key={idx} className="flex flex-col">
                        <span className="font-semibold text-gray-900">{m.subject}</span>
                        {m.date && (
                          <span className="text-xs text-blue-600 font-medium mt-1">📌 Date: {m.date}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* DATES SECTION */}
              {digestText?.dates && Array.isArray(digestText.dates) && digestText.dates.length > 0 && (
                <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600">🗓️</span>
                    <h3 className="text-md font-semibold text-gray-900">Detected Dates</h3>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {digestText.dates.map((d: string, idx: number) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* TOP SENDERS SECTION */}
              {digestText?.topSenders && Array.isArray(digestText.topSenders) && digestText.topSenders.length > 0 && (
                <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-600">📨</span>
                    <h3 className="text-md font-semibold text-gray-900">Top Senders</h3>
                  </div>

                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 font-semibold text-gray-700">Sender</th>
                        <th className="py-2 font-semibold text-gray-700 w-20">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {digestText.topSenders.map((s: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{s.sender}</td>
                          <td className="py-2 font-bold text-gray-900">{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary Section */}
              <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600">
                    📄
                  </span>
                  <h3 className="text-md font-semibold text-gray-900">Summary</h3>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-800">
                  {typeof digestText === "string" ? digestText : digestText?.summary}
                </p>
              </div>

              {/* Highlights Section */}
              {digestText?.highlights && Array.isArray(digestText.highlights) && (
                <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-600">
                      ⭐
                    </span>
                    <h3 className="text-md font-semibold text-gray-900">Highlights</h3>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {digestText.highlights.map((h: string, idx: number) => (
                      <li key={idx}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {digestText?.actions && Array.isArray(digestText.actions) && digestText.actions.length > 0 && (
                <div className="bg-white p-5 rounded-xl shadow border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-600">
                      ⚡
                    </span>
                    <h3 className="text-md font-semibold text-gray-900">Action Items</h3>
                  </div>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                    {digestText.actions.map((a: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium text-gray-900">{a.text}</span>
                        {a.due && (
                          <span className="ml-2 text-xs text-gray-500">(Due: {a.due})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}