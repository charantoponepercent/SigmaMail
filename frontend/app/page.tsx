"use client";
import { useEffect, useState } from "react";

type Email = { id: string; subject: string; from: string };
type EmailDetail = { id: string; subject: string; from: string; date: string; body: string };

export default function Home() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch list of emails
  useEffect(() => {
    fetch("http://localhost:4000/api/gmail/messages")
      .then((res) => res.json())
      .then((data) => {
        setEmails(data.messages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch single email by ID
  async function openEmail(id: string) {
    setLoadingDetail(true);
    setSelectedEmail(null);
    try {
      const res = await fetch(`http://localhost:4000/api/gmail/messages/${id}`);
      const data = await res.json();
      setSelectedEmail(data);
    } catch {
      alert("Failed to load email");
    }
    setLoadingDetail(false);
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* LEFT SIDEBAR */}
      <div className="w-1/5 bg-white border-r border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-4">📥 Mailbox</h2>
        <ul className="space-y-2 text-sm">
          <li className="cursor-pointer hover:text-blue-600">Inbox</li>
          <li className="cursor-pointer hover:text-blue-600">Starred</li>
          <li className="cursor-pointer hover:text-blue-600">Sent</li>
        </ul>
      </div>

      {/* MIDDLE SECTION – EMAIL LIST */}
      <div className="w-2/5 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b bg-white sticky top-0">
          <h2 className="text-xl font-semibold">Inbox</h2>
        </div>

        {loading ? (
          <p className="p-4 text-gray-500">Loading emails…</p>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              onClick={() => openEmail(email.id)}
              className="p-4 border-b hover:bg-gray-100 cursor-pointer transition"
            >
              <p className="text-sm font-semibold truncate">{email.from}</p>
              <p className="text-md truncate">{email.subject}</p>
            </div>
          ))
        )}
      </div>

      {/* RIGHT SECTION – EMAIL DETAIL VIEWER */}
      <div className="flex-1 bg-white p-6 overflow-y-auto">
        {!selectedEmail && !loadingDetail && (
          <p className="text-gray-500">Select an email to view details</p>
        )}

        {loadingDetail && <p className="text-gray-500">Loading message…</p>}

        {selectedEmail && (
          <div>
            <h2 className="text-2xl font-bold mb-1">{selectedEmail.subject}</h2>
            <p className="text-sm text-gray-600 mb-4">
              From: {selectedEmail.from}
              <br />
              Date: {selectedEmail.date}
            </p>
            <pre className="whitespace-pre-wrap text-gray-800">
              {selectedEmail.body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
