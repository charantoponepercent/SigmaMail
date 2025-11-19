/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import DisconnectDialog from "@/components/DisconnectDialog";
import ThreadViewer from "@/components/ThreadViewer";
import ThreadSkeleton from './ThreadSkeleton.js'

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

  // const [labelCounts, setLabelCounts] = useState<any>({});
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [currentFolder, setCurrentFolder] = useState("INBOX");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
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
    if (selectedAccount) {
      loadMessages(selectedAccount, currentFolder);
      // loadLabelCounts(selectedAccount);
    }
  }, [selectedAccount, currentFolder]);

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


  // async function loadLabelCounts(account: string) {
  //   const token = localStorage.getItem("token");
  
  //   const res = await fetch(
  //     `${API_BASE}/api/gmail/labels?account=${encodeURIComponent(account)}`,
  //     { headers: { Authorization: `Bearer ${token}` } }
  //   );
  
  //   const data = await res.json();
  //   setLabelCounts(data);
  // }

  // ✅ Load & group messages by thread
  async function loadMessages(account: string, label = currentFolder, pageToken?: string) {
    setLoadingMessages(true);
  
    const token = localStorage.getItem("token");
  
    try {
      const res = await fetch(
        `${API_BASE}/api/gmail/messages?account=${encodeURIComponent(
          account
        )}&label=${label}&max=30${pageToken ? `&pageToken=${pageToken}` : ""}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      const data = await res.json();
      const rawMessages = (Array.isArray(data?.messages)
        ? data.messages
        : []) as DashboardMessage[];
  
      const grouped: DashboardMessage[] = Object.values(
        rawMessages.reduce<Record<string, DashboardMessage>>((acc, msg) => {
          const key = msg.threadId || msg.id;
          if (!acc[key]) {
            acc[key] = { ...msg, count: 1 };
          } else {
            acc[key].count = (acc[key].count || 0) + 1;
          }
          return acc;
        }, {})
      );
  
      if (pageToken) {
        // append
        setMessages((prev) => [...prev, ...grouped]);
      } else {
        // first page load
        setMessages(grouped);
      }
  
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error("Pagination error:", err);
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
      console.log("openMessage CALLED with id:", id);
      const token = localStorage.getItem("token");
      if (!selectedAccount) return;

      setLoadingThread(true);

      try {
        // Step 1: fetch single message (ensures we get threadId and a single-message fallback)
        const msgRes = await fetch(
          `${API_BASE}/api/gmail/messages/${id}?account=${encodeURIComponent(selectedAccount)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) throw new Error("Failed to fetch message");
        const msgData = await msgRes.json();

        // If the message didn't have a threadId for some reason, show just that message
        if (!msgData.threadId) {
          setSelectedMessage({ messages: [msgData], threadId: msgData.id });
          setSelectedThreadId(msgData.id);
          return;
        }

        // Step 2: fetch full thread using thread id (thread route is resilient)
        const threadRes = await fetch(
          `${API_BASE}/api/gmail/thread/${msgData.threadId}?account=${encodeURIComponent(selectedAccount)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!threadRes.ok) {
          // try fallback: call thread route with original message id (route auto-resolves)
          const fallback = await fetch(
            `${API_BASE}/api/gmail/thread/${id}?account=${encodeURIComponent(selectedAccount)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!fallback.ok) throw new Error("Failed to fetch thread");
          const fallbackData = await fallback.json();
          setSelectedMessage(fallbackData);
          setSelectedThreadId(fallbackData.threadId || id);
          return;
        }

        const threadData = await threadRes.json();

        setSelectedMessage(threadData);
        setSelectedThreadId(threadData.threadId || msgData.threadId);
      } catch (err) {
        console.error("Error loading thread:", err);
        // optionally: show toast to user
      }

      finally {
        setLoadingThread(false);
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
  

  if (!mounted) return null;

  // ✅ UI Layout
  return (
    <div className="flex h-screen bg-slate-100 text-gray-800 text-[14px] leading-tight">
  {/* LEFT PANEL - Sidebar (Fixed Width) */}
  <aside className="w-[260px] border rounded-3xl ml-3 mt-3 mb-3 border-gray-300 flex flex-col bg-gray-50 flex-shrink-0 overflow-hidden">
    {/* TOP SECTION: User Info & All Inbox */}
    <div className="p-4 flex flex-col gap-6">
      {/* User Header */}
      <div className="flex items-center justify-between">
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

      {/* All Inbox Tab */}
      <div
        onClick={() => {
          setSelectedAccount("ALL");
          // Logic to load all messages can be added here
          // For now, we might just clear the specific account filter or handle "ALL" in loadMessages
        }}
        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg transition-all border
          ${
            selectedAccount === "ALL"
              ? "bg-white border-gray-200 shadow-sm text-gray-900"
              : "border-transparent hover:bg-gray-100 text-gray-600"
          }
        `}
      >
        <Inbox className={`w-4 h-4 ${selectedAccount === "ALL" ? "text-blue-600" : "text-gray-500"}`} />
        <span className="text-[13.5px] font-medium">All Inbox</span>
      </div>
    </div>

    {/* SPACER to push accounts to bottom */}
    <div className="flex-1"></div>

    {/* BOTTOM SECTION: Connected Accounts & Settings */}
    <div className="p-4 pt-0">
      {/* Connected Accounts */}
      <div className="mb-4">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase mb-2 tracking-widest px-1">
          Connected Accounts
        </h2>

        <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
          {accounts.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">
              No accounts connected
            </p>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc._id}
                className={`group relative flex items-center justify-between gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedAccount === acc.email
                    ? "bg-white shadow-sm text-gray-900"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                onClick={() => setSelectedAccount(acc.email)}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-gray-600 text-[10px] font-bold uppercase">
                    {acc.email[0]}
                  </div>
                  <span className="truncate text-[13px] font-medium">
                    {acc.email}
                  </span>
                </div>

                {/* Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all"
                      title="More options"
                    >
                      <EllipsisVertical className="w-3.5 h-3.5 text-gray-500" />
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

      {/* Settings & Logout */}
      <div className="border-t border-gray-200 pt-3 space-y-1">
        <button
          onClick={() => alert("Settings clicked")}
          className="w-full flex items-center justify-between hover:bg-gray-100 px-2 py-2 rounded-md transition text-gray-600"
        >
          <span className="text-[13px] font-medium">Settings</span>
          <Settings className="w-4 h-4 text-gray-400" />
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center justify-between hover:bg-red-50 px-2 py-2 rounded-md text-red-600 transition"
        >
          <span className="text-[13px] font-medium">Logout</span>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>

  {/* MAIN CONTENT AREA - Dynamic Flex Layout */}
  <div className="flex-1 m-1 flex overflow-hidden">
    {/* MIDDLE PANEL - Email List */}
    <section 
      className={`border-r-2 border-l-2  mr-3 mt-3 mb-3 border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out ${
        selectedMessage 
          ? "w-3/8" // 50% when thread is open
          : "flex-1"  // Full width when no thread
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sticky top-0 bg-white z-10">
        <h2 className="font-semibold text-gray-500 text-sm tracking-tight">
          {selectedAccount || "Select Account"}
        </h2>
        {loadingMessages && (
          <span className="text-[16px] text-gray-400">Loading...</span>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100 sticky top-[48px] bg-white z-10">
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
      <div className="flex-1 p-3 overflow-y-auto space-y-1 bg-white">
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
                className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all rounded-xl drop-shadow-[0_0_1px_rgba(0,0,0,0.05)] bg-white border border-gray-200 
  hover:shadow-md hover:bg-gray-50 ${
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

        {nextPageToken && selectedAccount && (
          <button
            onClick={() => {
              const prevThread = selectedThreadId;
              loadMessages(selectedAccount, currentFolder, nextPageToken).then(() => {
                if (prevThread) setSelectedThreadId(prevThread);
              });
            }}
            className="w-full py-2 mt-3 text-blue-600 hover:bg-blue-50 rounded"
          >
            Load more
          </button>
        )}
      </div>
    </section>

    {/* RIGHT PANEL - Thread Viewer (Slides in/out) */}
    <section 
      className={`bg-white mt-3 mb-3 rounded-3xl overflow-hidden transition-all duration-300 ease-in-out ${
        selectedMessage 
          ? "w-3/5 opacity-100" // 50% width and visible when open
          : "w-0 opacity-0"      // Hidden when closed
      }`}
    >
      <div className="h-full overflow-y-auto p-6">
        {loadingThread ? (
          <ThreadSkeleton />
        ) : selectedMessage ? (
          <ThreadViewer
            thread={selectedMessage}
            onClose={() => {
              setSelectedMessage(null);
              setSelectedThreadId(null);
            }}
            onPrev={goPrevThread}
            onNext={goNextThread}
          />
        ) : null}
      </div>
    </section>
  </div>

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
