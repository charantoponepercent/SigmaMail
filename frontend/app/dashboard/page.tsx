"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

type DashboardUser = { id: string; name: string };
type DashboardAccount = { _id: string; email: string };
type DashboardMessage = { id: string; subject: string; from: string; date?: string; body?: string };

export default function Dashboard() {
  const router = useRouter();
  const [user] = useState<DashboardUser | null>(() => {
    if (typeof window === "undefined") return null;
    const userData = localStorage.getItem("user");
    return userData ? (JSON.parse(userData) as DashboardUser) : null;
  });
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<DashboardMessage | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadAccounts = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAccounts(data.accounts || []);
      if (data.accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(data.accounts[0].email);
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [selectedAccount]);

  useEffect(() => {
    const t1 = setTimeout(() => setMounted(true), 0);
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/login");
      return () => clearTimeout(t1);
    }
    const t2 = setTimeout(() => {
      void loadAccounts(token);
    }, 0);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router, loadAccounts]);

  async function loadMessages(account: string) {
    setLoadingMessages(true);
    setSelectedMessage(null);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_BASE}/api/gmail/messages?account=${encodeURIComponent(account)}&max=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: unknown) {
      console.error(err);
    }
    setLoadingMessages(false);
  }

  async function openMessage(id: string) {
    const token = localStorage.getItem("token");
    if (!selectedAccount) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/gmail/messages/${id}?account=${encodeURIComponent(selectedAccount)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setSelectedMessage(data as DashboardMessage);
    } catch (err: unknown) {
      console.error(err);
    }
  }

  function connectNewGmail() {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const url = `${API_BASE}/auth/google?userId=${u.id}`;
    window.open(url, "_blank", "width=800,height=700");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  useEffect(() => {
    if (!selectedAccount) return;
    const t = setTimeout(() => {
      void loadMessages(selectedAccount);
    }, 0);
    return () => clearTimeout(t);
  }, [selectedAccount]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-700">Universal Email Aggregator</h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-700">
            {user ? `Hi, ${user.name}` : ""}
          </span>
          <button
            onClick={logout}
            className="text-sm text-red-500 underline hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      {/* 3-column Gmail-like layout */}
      <main className="flex-1 grid grid-cols-12 border-t">
        {/* LEFT SIDEBAR */}
        <aside className="col-span-2 border-r bg-white p-4 flex flex-col justify-between">
          <div>
            <h2 className="font-semibold text-gray-700 mb-2">Accounts</h2>
            <ul className="space-y-1">
              {accounts.map((acc) => (
                <li
                  key={acc._id}
                  onClick={() => setSelectedAccount(acc.email)}
                  className={`cursor-pointer p-2 rounded ${
                    selectedAccount === acc.email
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {acc.email}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={connectNewGmail}
            className="mt-4 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Gmail
          </button>
        </aside>

        {/* MIDDLE: EMAIL LIST */}
        <section className="col-span-4 border-r bg-gray-50 overflow-y-auto">
          <div className="p-3 border-b bg-white flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">
              {selectedAccount ? selectedAccount : "Select Account"}
            </h2>
            {loadingMessages && (
              <span className="text-sm text-gray-500">Loading...</span>
            )}
          </div>

          {!selectedAccount ? (
            <p className="p-4 text-gray-500">Please select an account</p>
          ) : messages.length === 0 ? (
            <p className="p-4 text-gray-500">No messages found</p>
          ) : (
            <ul>
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  onClick={() => openMessage(msg.id)}
                  className={`cursor-pointer border-b p-3 hover:bg-blue-50 ${
                    selectedMessage?.id === msg.id
                      ? "bg-blue-100 border-l-4 border-blue-500"
                      : ""
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {msg.subject}
                  </p>
                  <p className="text-xs text-gray-600">{msg.from}</p>
                  <p className="text-xs text-gray-400">{msg.date}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* RIGHT: EMAIL VIEWER */}
        <section className="col-span-6 bg-white overflow-y-auto p-6">
          {selectedMessage ? (
            <div>
              <h2 className="text-lg font-semibold mb-2">
                {selectedMessage.subject}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                From: {selectedMessage.from}
              </p>
              <pre className="whitespace-pre-wrap text-sm text-gray-800">
                {selectedMessage.body || "(No content)"}
              </pre>
            </div>
          ) : (
            <p className="text-gray-400 italic">
              Select an email to view its content
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
