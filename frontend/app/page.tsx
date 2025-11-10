"use client";
import { useEffect, useState } from "react";

type Email = {
  id: string;
  subject: string;
  from: string;
};

export default function Home() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/api/gmail/messages")
      .then((res) => res.json())
      .then((data) => {
        setEmails(data.messages);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* LEFT SIDEBAR */}
      <div className="w-1/5 bg-white border-r border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-4">📥 Mailbox</h2>
        <ul className="space-y-2 text-sm">
          <li className="cursor-pointer hover:text-blue-600">Inbox</li>
          <li className="cursor-pointer hover:text-blue-600">Starred</li>
          <li className="cursor-pointer hover:text-blue-600">Sent</li>
          <li className="cursor-pointer hover:text-blue-600">Drafts</li>
        </ul>
      </div>

      {/* MIDDLE SECTION (Threads) */}
      <div className="w-2/5 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b bg-white sticky top-0">
          <h2 className="text-xl font-semibold">Inbox</h2>
        </div>

        {loading ? (
          <p className="p-4 text-gray-500">Loading emails...</p>
        ) : emails.length === 0 ? (
          <p className="p-4 text-gray-500">No emails found</p>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className="p-4 border-b hover:bg-gray-100 cursor-pointer transition"
            >
              <p className="text-sm font-semibold truncate">{email.from}</p>
              <p className="text-md truncate">{email.subject}</p>
            </div>
          ))
        )}
      </div>

      {/* RIGHT SECTION (Thread placeholder) */}
      <div className="flex-1 bg-white p-6">
        <h2 className="text-xl font-bold">Select an email to view details</h2>
        <p className="text-gray-500 mt-2">
          (In the next update, this will show the full thread + summary.)
        </p>
      </div>
    </div>
  );
}
