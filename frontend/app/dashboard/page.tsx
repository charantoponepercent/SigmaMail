"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import DisconnectDialog from "@/components/DisconnectDialog";
import SecureEmailViewer from "@/components/SecureEmailViewer";

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
  subject: string;
  from: string;
  date?: string;
  body?: string;
  hidden?: boolean;
};

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [selectedMessage, setSelectedMessage] =
    useState<DashboardMessage | null>(null);
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

  
  async function loadMessages(account: string) {
    setLoadingMessages(true);
    setSelectedMessage(null);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_BASE}/api/gmail/messages?account=${encodeURIComponent(
          account
        )}&max=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setMessages(data.messages || []);
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

  async function openMessage(id: string) {
    const token = localStorage.getItem("token");
    if (!selectedAccount) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/gmail/messages/${id}?account=${encodeURIComponent(
          selectedAccount
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSelectedMessage(data);
    } catch (err) {
      console.error(err);
    }
  }

  function connectNewGmail() {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const url = `${API_BASE}/auth/google?userId=${u.id}`;
    window.open(url, "_blank", "width=800,height=700");
  }

  function getAvatarInitial(fromField?: string): string {
    if (!fromField || typeof fromField !== "string") return "M";
  
    // Handle formats like "Google <no-reply@google.com>"
    const nameMatch = fromField.match(/^[^<]+/);
    if (nameMatch && nameMatch[0].trim().length > 0) {
      const name = nameMatch[0].trim();
      return name.charAt(0).toUpperCase();
    }
  
    // Handle plain emails like "no-reply@google.com"
    const emailMatch = fromField.match(/^([^@]+)/);
    if (emailMatch && emailMatch[1]) {
      return emailMatch[1].charAt(0).toUpperCase();
    }
  
    // Fallback
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("❌ " + errorMessage);
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

  return (
    <div className="flex h-screen bg-slate-100 text-gray-800 text-[14px] leading-tight">

<aside className="w-[240px] border-r border-gray-200 flex flex-col justify-between bg-gray-50">
  {/* ─── TOP SECTION ─────────────────────── */}
  <div className="p-4">
    {/* User Header */}
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
  {/* Section Header */}
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
      Connected Accounts
    </h2>
  </div>

  {/* Account List */}
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
          {/* Gmail Icon / Placeholder */}
          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-[11px] font-bold uppercase shadow-sm">
              {acc.email[0]}
            </div>
            <span className="truncate text-[13px] text-gray-800 font-medium group-hover:text-gray-900">
              {acc.email}
            </span>
          </div>

          {/* Options Menu */}
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


    {/* Navigation / Folders */}
    <div>
      <h2 className="text-[11px] font-semibold text-gray-500 uppercase mb-2 tracking-wide">
        Folders
      </h2>
      <div className="space-y-1">
        {[
          { name: "Inbox", icon: Inbox },
          { name: "Sent", icon: Send },
          { name: "Archive", icon: Archive },
          { name: "Trash", icon: Trash2 },
        ].map((item) => (
          <button
            key={item.name}
            className={`w-full flex items-center gap-3 text-[13.5px] text-gray-700 p-2 rounded-md hover:bg-blue-50 hover:text-blue-700 transition ${
              item.name === "Inbox" ? "font-medium text-blue-700" : ""
            }`}
          >
            <item.icon className="w-4 h-4 opacity-80" />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  </div>

  {/* ─── BOTTOM SECTION ─────────────────── */}
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
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sticky top-0 bg-white z-10">
            <h2 className="font-semibold text-gray-500 text-sm tracking-tight">
              {selectedAccount || "Select Account"}
            </h2>
            {loadingMessages && (
              <span className="text-[16px] text-gray-400">Loading...</span>
            )}
          </div>

          {/* Search Bar */}
          <div className="px-4 w-2/3 py-2 border-b border-gray-100 sticky top-[48px] bg-white z-10">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
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
                    key={msg.id || idx}
                    onClick={() => openMessage(msg.id)}
                    className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${
                      selectedMessage?.id === msg.id
                        ? "bg-blue-50 rounded-2xl"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[12px] font-semibold uppercase">
                      {getAvatarInitial(msg.from)}
                    </div>

                    {/* Sender & Message Info */}
                    <div className="flex-1 p-1 min-w-0">
                      {/* Top Row: Sender + Timestamp */}
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-[13.5px] font-semibold text-gray-900 truncate group-hover:text-blue-600">
                          {msg.from?.split("<")[0].trim() || "Unknown Sender"}
                        </h3>
                        <span className="text-[11.5px] text-gray-500 whitespace-nowrap ml-2">
                          {formatDate(msg.date)}
                        </span>
                      </div>

                      {/* Subject */}
                      <p className="text-[13px] text-gray-800 truncate font-medium">
                        {msg.subject || "(No Subject)"}
                      </p>

                      {/* Snippet */}
                      <p className="text-[12px] text-gray-500 truncate leading-snug">
                        {msg.body
                          ?.replace(/<\/?[^>]+(>|$)/g, "")
                          .slice(0, 80) || ""}
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
          <div className="space-y-5">
            {/* Top Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">

            <button
              onClick={() => setSelectedMessage(null)}
              className="p-2 border-r-2 cursor-pointer  hover:bg-red-100"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 text-bold text-gray-800"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
              {/* Backward */}
              <button
                onClick={() => {
                  if (!selectedMessage) return;
                  const idx = messages.findIndex((m) => m.id === selectedMessage.id);
                  if (idx > 0) openMessage(messages[idx - 1].id); // ✅ fetches full next message
                }}
                className="p-2 cursor-pointer  rounded hover:bg-gray-100"
                title="Previous"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </button>

              {/* Forward */}
              <button
                onClick={() => {
                  if (!selectedMessage) return;
                  const idx = messages.findIndex((m) => m.id === selectedMessage.id);
                  if (idx < messages.length - 1) openMessage(messages[idx + 1].id); // ✅ fetches next message content
                }}
                className="p-2 cursor-pointer rounded hover:bg-gray-100"
                title="Next"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            </div>

            {/* Close */}
            
          </div>


            {/* SUBJECT HEADER */}
            <div>
              <h2 className="text-[16px] font-semibold text-gray-900 mb-2">
                {selectedMessage.subject}
              </h2>
              <div className="flex items-center justify-between text-[12px] text-gray-500">
                <div className="flex items-center gap-2">
                  {/* <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full font-medium text-gray-700">
                    {selectedMessage.from?.[0]?.toUpperCase()}
                  </div> */}
                  <div className="relative group">
                    <p className="font-medium rounded-full border px-3 py-2 bg-gray-200 text-gray-800 cursor-default">
                      {selectedMessage.from?.split("<")[0] || "Unknown"}
                    </p>
                    <div className="hidden group-hover:block absolute top-6 left-0 bg-gray-900 text-white text-[11px] rounded-md shadow-lg p-2 whitespace-nowrap">
                      {selectedMessage.from || "No email"}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500">
                  {formatDate(selectedMessage.date)}
                </span>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* BODY */}
            
            <SecureEmailViewer
              html={selectedMessage.body || ""}
              senderEmail={selectedMessage.from || ""}
              theme="light"
            />

          </div>
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
