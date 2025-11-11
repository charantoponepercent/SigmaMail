/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import DisconnectDialog from "@/components/DisconnectDialog";
import ThreadViewer from "@/components/ThreadViewer";

import {
  Search,
  Inbox,
  Send,
  Archive,
  Trash2,
  Plus,
  Settings,
  LogOut,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";

type DashboardUser = { id: string; name: string };
type DashboardAccount = { _id: string; email: string };
type DashboardMessage = {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  date?: string;
  body?: string;
  hidden?: boolean;
  count?: number;
};
type DashboardThread = { messages: DashboardMessage[]; threadId?: string };

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [selectedMessage, setSelectedMessage] =
    useState<DashboardThread | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<string | null>(
    null
  );

  const loadAccounts = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0].email);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [selectedAccount]
  );

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(userData) as DashboardUser;
    setUser(parsed);
    loadAccounts(token);
  }, [router, loadAccounts]);

  // ✅ Load & group messages by thread
  async function loadMessages(account: string) {
    setLoadingMessages(true);
    setSelectedMessage(null);
    setSelectedThreadId(null);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_BASE}/api/gmail/messages?account=${encodeURIComponent(
          account
        )}&max=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();

      // ✅ Group messages by threadId
      const grouped = Object.values(
        data.messages.reduce((acc: any, msg: any) => {
          const key = msg.threadId || msg.id;
          if (!acc[key]) acc[key] = { ...msg, count: 1 };
          else acc[key].count += 1;
          return acc;
        }, {})
      );

      setMessages(grouped as DashboardMessage[]);
    } catch (err) {
      console.error(err);
    }

    setLoadingMessages(false);
  }

  function formatDate(dateString?: string) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const options: Intl.DateTimeFormatOptions = isToday
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" };
    return date.toLocaleString("en-US", options);
  }

  // ✅ Open a thread when clicked
  async function openMessage(id: string) {
    const token = localStorage.getItem("token");
    if (!selectedAccount) return;

    try {
      // Step 1: Get threadId from message
      const msgRes = await fetch(
        `${API_BASE}/api/gmail/messages/${id}?account=${encodeURIComponent(
          selectedAccount
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msgData = await msgRes.json();

      // Step 2: Fetch full thread
      if (!msgData.threadId) {
        const fallbackKey = msgData.id as string;
        setSelectedMessage({ messages: [msgData], threadId: fallbackKey });
        setSelectedThreadId(fallbackKey);
        return;
      }

      const threadRes = await fetch(
        `${API_BASE}/api/gmail/thread/${msgData.threadId}?account=${encodeURIComponent(
          selectedAccount
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const threadData = await threadRes.json();
      setSelectedMessage({ ...threadData, threadId: msgData.threadId });
      setSelectedThreadId(msgData.threadId);
    } catch (err) {
      console.error("Error loading thread:", err);
    }
  }

  function connectNewGmail() {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const url = `${API_BASE}/auth/google?userId=${u.id}`;
    window.open(url, "_blank", "width=800,height=700");
  }

  function getAvatarInitial(fromField?: string): string {
    if (!fromField || typeof fromField !== "string") return "M";
    const nameMatch = fromField.match(/^[^<]+/);
    if (nameMatch && nameMatch[0].trim().length > 0)
      return nameMatch[0].trim().charAt(0).toUpperCase();
    const emailMatch = fromField.match(/^([^@]+)/);
    if (emailMatch && emailMatch[1])
      return emailMatch[1].charAt(0).toUpperCase();
    return "M";
  }

  async function disconnectAccount(email: string) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_BASE}/api/accounts/${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disconnect");
      setAccounts((prev) => prev.filter((acc) => acc.email !== email));
      if (selectedAccount === email) {
        setSelectedAccount(null);
        setMessages([]);
        setSelectedMessage(null);
      }
    } catch (err: any) {
      alert("❌ " + err.message);
    }
  }

  // Navigate between threads in the middle list
  function getVisibleThreads() {
    return messages.filter((m) => !m.hidden);
  }
  function getCurrentThreadKey(): string | null {
    if (selectedThreadId) return selectedThreadId;
    const fromSelected =
      selectedMessage?.threadId ||
      selectedMessage?.messages?.[0]?.threadId ||
      selectedMessage?.messages?.[0]?.id ||
      null;
    return fromSelected ?? null;
  }
  function getSelectedIndex(visible: DashboardMessage[]) {
    const key = getCurrentThreadKey();
    if (!key) return -1;
    return visible.findIndex((m) => (m.threadId || m.id) === key);
  }
  function scrollThreadIntoView(threadKey: string) {
    const el = document.querySelector(
      `[data-thread-id="${threadKey}"]`
    ) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function goPrevThread() {
    const key = getCurrentThreadKey();
    if (!key) return;
    const visible = getVisibleThreads();
    const idx = getSelectedIndex(visible);
    if (idx > 0) {
      const target = visible[idx - 1];
      const key = target.threadId || target.id;
      openMessage(target.id);
      scrollThreadIntoView(key);
    }
  }
  function goNextThread() {
    const key = getCurrentThreadKey();
    if (!key) return;
    const visible = getVisibleThreads();
    const idx = getSelectedIndex(visible);
    if (idx >= 0 && idx < visible.length - 1) {
      const target = visible[idx + 1];
      const key = target.threadId || target.id;
      openMessage(target.id);
      scrollThreadIntoView(key);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  useEffect(() => {
    if (selectedAccount) loadMessages(selectedAccount);
  }, [selectedAccount]);

  if (!mounted) return null;

  // ✅ UI Layout
  return (
    <div className="flex h-screen bg-slate-100 text-gray-800 text-[14px] leading-tight">
      {/* LEFT PANEL */}
      <aside className="w-[240px] border-r border-gray-200 flex flex-col justify-between bg-gray-50">
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-base font-semibold text-gray-800 tracking-tight">
                {user?.name || "User"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Personal Workspace</p>
            </div>
            <button
              onClick={connectNewGmail}
              className="p-1.5 bg-blue-600 cursor-pointer text-white rounded-md hover:bg-blue-700 transition"
              title="Connect Gmail Account"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Connected Accounts */}
          <div className="mb-8">
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase mb-3 tracking-widest">
              Connected Accounts
            </h2>

            <div className="space-y-1.5">
              {accounts.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No accounts connected
                </p>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc._id}
                    className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer border transition-all duration-200 ${
                      selectedAccount === acc.email
                        ? "border-blue-300 bg-blue-50 text-blue-700 font-medium shadow-sm"
                        : "border-transparent hover:bg-gray-50 hover:border-gray-200"
                    }`}
                    onClick={() => setSelectedAccount(acc.email)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-[11px] font-bold uppercase shadow-sm">
                        {acc.email[0]}
                      </div>
                      <span className="truncate text-[13px] text-gray-800 font-medium group-hover:text-gray-900">
                        {acc.email}
                      </span>
                    </div>

                    {/* Options */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-all"
                          title="More options"
                        >
                          <EllipsisVertical className="w-4 h-4 text-gray-500" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-[140px] bg-white shadow-lg border border-gray-100 rounded-md p-1"
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            setAccountToDisconnect(acc.email);
                            setShowDialog(true);
                          }}
                          className="text-[13px] text-red-600 font-medium cursor-pointer rounded-sm hover:bg-red-50"
                        >
                          Disconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-100 px-4 py-3 space-y-2 text-sm">
          <button
            onClick={() => alert("Settings clicked")}
            className="w-full flex items-center justify-between hover:bg-white p-2 rounded-md transition"
          >
            <span className="text-gray-700">Settings</span>
            <Settings className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-between hover:bg-white p-2 rounded-md text-red-500 transition"
          >
            <span>Logout</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MIDDLE PANEL */}
      <section className="w-[440px] border-r-2 border-gray-100 bg-white flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-500 text-sm tracking-tight">
            {selectedAccount || "Select Account"}
          </h2>
          {loadingMessages && (
            <span className="text-[16px] text-gray-400">Loading...</span>
          )}
        </div>

        {/* Search */}
        <div className="px-4 w-2/3 py-2 border-b border-gray-100 sticky top-[48px] bg-white z-10">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search mail"
              className="w-full text-sm bg-transparent outline-none placeholder-gray-400"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                setMessages((prev) =>
                  prev.map((msg) => ({
                    ...msg,
                    hidden: q
                      ? !msg.subject?.toLowerCase().includes(q) &&
                        !msg.from?.toLowerCase().includes(q)
                      : false,
                  }))
                );
              }}
            />
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 p-1 overflow-y-auto divide-y divide-gray-100 bg-white">
          {!selectedAccount ? (
            <p className="p-4 text-gray-500 text-sm">Select an account</p>
          ) : messages.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No messages found</p>
          ) : (
            messages
              .filter((msg) => !msg.hidden)
              .map((msg, idx) => (
                <div
                  key={msg.threadId || msg.id || idx}
                  onClick={() => openMessage(msg.id)}
                  data-thread-id={msg.threadId || msg.id}
                  className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${
                    selectedThreadId === (msg.threadId || msg.id) ||
                    (selectedMessage?.messages?.some(
                      (m) =>
                        m.threadId === msg.threadId ||
                        m.id === msg.id ||
                        (selectedMessage?.threadId &&
                          selectedMessage.threadId === msg.threadId)
                    ) ?? false)
                      ? "bg-blue-50 rounded-2xl"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[12px] font-semibold uppercase">
                    {getAvatarInitial(msg.from)}
                  </div>

                  <div className="flex-1 p-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-[13.5px] font-semibold text-gray-900 truncate group-hover:text-blue-600">
                        {msg.from?.split("<")[0].trim() || "Unknown Sender"}
                         {(msg.count ?? 1) > 1 && (
                          <span className="ml-1 text-[12px] text-gray-500">
                             [{msg.count ?? 1}]
                          </span>
                        )}
                      </h3>
                      <span className="text-[11.5px] text-gray-500 whitespace-nowrap ml-2">
                        {formatDate(msg.date)}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-800 truncate font-medium">
                      {msg.subject || "(No Subject)"}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      {/* RIGHT PANEL */}
      <section className="flex-1 bg-white overflow-y-auto p-6">
  {selectedMessage ? (
    <ThreadViewer
      thread={selectedMessage}
      onClose={() => {
        setSelectedMessage(null);
        setSelectedThreadId(null);
      }}
      onPrev={goPrevThread}
      onNext={goNextThread}
    />
  ) : (
    <div className="flex h-full items-center justify-center text-gray-400 italic">
      Select an email to preview
    </div>
  )}
</section>


      <DisconnectDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        accountEmail={accountToDisconnect}
        onConfirm={() => {
          if (accountToDisconnect) disconnectAccount(accountToDisconnect);
        }}
      />
    </div>
  );
}
