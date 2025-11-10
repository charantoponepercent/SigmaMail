"use client";
import { useEffect, useState } from "react";

type Account = { _id: string; email: string; provider: string };
type Email = { id: string; subject: string; from: string; date?: string };
type EmailDetail = { id: string; subject: string; from: string; date?: string; body?: string };

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // For dev auth: set this to the app user's email and include header x-user-email in requests
  const DEV_USER_EMAIL = "your.app.user@example.com";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  useEffect(() => {
    async function loadAccounts() {
      setLoadingAccounts(true);
      try {
        const res = await fetch(`${API_BASE}/api/accounts`, {
          headers: { "x-user-email": DEV_USER_EMAIL },
        });
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length) setSelectedAccount(data.accounts[0]);
      } catch (err) {
        console.error(err);
      }
      setLoadingAccounts(false);
    }
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    async function loadEmails() {
      setLoadingEmails(true);
      setEmails([]);
      setSelectedEmail(null);
      try {
        const res = await fetch(`${API_BASE}/api/gmail/messages?account=${encodeURIComponent(selectedAccount!.email)}&max=30`, {
          headers: { "x-user-email": DEV_USER_EMAIL },
        });
        const data = await res.json();
        setEmails(data.messages || []);
      } catch (err) {
        console.error(err);
      }
      setLoadingEmails(false);
    }
    loadEmails();
  }, [selectedAccount]);

  async function openEmail(id: string) {
    if (!selectedAccount) return;
    setLoadingDetail(true);
    setSelectedEmail(null);
    try {
      const res = await fetch(`${API_BASE}/api/gmail/messages/${id}?account=${encodeURIComponent(selectedAccount!.email)}`, {
        headers: { "x-user-email": DEV_USER_EMAIL },
      });
      const d = await res.json();
      setSelectedEmail(d);
    } catch (err) {
      console.error(err);
      alert("Failed to load email");
    }
    setLoadingDetail(false);
  }

  function connectNewAccount() {
    // open auth URL – include userEmail for dev mapping
    const url = `${API_BASE}/auth/google?userEmail=${encodeURIComponent(DEV_USER_EMAIL)}`;
    window.open(url, "_blank", "width=800,height=700");
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Left sidebar: accounts */}
      <div className="w-1/5 bg-white border-r p-4">
        <div className="mb-4 flex justify-between items-center">
          <h3 className="font-semibold">Accounts</h3>
          <button onClick={connectNewAccount} className="text-sm text-blue-600">+ Add</button>
        </div>

        {loadingAccounts ? <p>Loading...</p> : (
          <ul>
            {accounts.map(acc => (
              <li key={acc._id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`p-2 rounded cursor-pointer ${selectedAccount?.email === acc.email ? "bg-blue-50 font-semibold" : "hover:bg-gray-100"}`}>
                {acc.email}
              </li>
            ))}
            {accounts.length === 0 && <li className="text-sm text-gray-500">No accounts connected</li>}
          </ul>
        )}
      </div>

      {/* Middle: message list */}
      <div className="w-2/5 border-r overflow-y-auto">
        <div className="p-4 border-b bg-white">
          <h2 className="text-xl font-semibold">
            {selectedAccount ? `Inbox — ${selectedAccount.email}` : "Inbox"}
          </h2>
        </div>

        {loadingEmails ? <p className="p-4">Loading emails…</p> : (
          emails.map(e => (
            <div key={e.id} onClick={() => openEmail(e.id)} className="p-4 border-b hover:bg-gray-100 cursor-pointer">
              <p className="text-sm font-semibold truncate">{e.from}</p>
              <p className="truncate">{e.subject}</p>
              <p className="text-xs text-gray-500">{e.date}</p>
            </div>
          ))
        )}

      </div>

      {/* Right: detail */}
      <div className="flex-1 bg-white p-6 overflow-y-auto">
        {!selectedEmail && !loadingDetail && <p className="text-gray-500">Select an email</p>}
        {loadingDetail && <p className="text-gray-500">Loading message…</p>}
        {selectedEmail && (
          <div>
            <h2 className="text-2xl font-bold mb-1">{selectedEmail.subject}</h2>
            <p className="text-sm text-gray-600 mb-4">From: {selectedEmail.from} <br/> Date: {selectedEmail.date}</p>
            <pre className="whitespace-pre-wrap">{selectedEmail.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
