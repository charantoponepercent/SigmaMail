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
import AIBubbleChat from "@/components/AIBubbleChat";


import {
  Search,
  Inbox,
  Send,
  Archive,
  Trash2,
  RefreshCw,
  Plus,
  Settings,
  LogOut,
  Loader2,
  Paperclip,
  Command,
  Keyboard,
  Sparkles,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";

type DashboardUser = { id: string; name: string };
type DashboardAccount = { _id: string; email: string };
type ThreadAttachment = {
  filename: string;
  mimeType: string;
  storageUrl?: string;
  messageId?: string;
  emailId?: string;
};
type DashboardMessage = {
  priority: any;
  billDue: any;
  snippet: any;
  preview: any;
  category: string;
  accountEmail: any;
  to: any;
  attachments: { filename: string; mimeType: string; storageUrl?: string }[];
  threadAttachmentCount?: number;
  starred: any;
  id: string;
  _id?: string;
  messageId?: string;
  threadId?: string;
  subject: string;
  from: string;
  date?: string;
  body?: string;
  hidden?: boolean;
  count?: number;
};


type DashboardThread = {
  messages?: DashboardMessage[];
  threadId?: string;
  account?: string;
  attachments?: ThreadAttachment[];
  threadAttachmentCount?: number;
};

export default function Dashboard() {
  const router = useRouter();

  // const [labelCounts, setLabelCounts] = useState<any>({});
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncClick() {
    try {
      setIsSyncing(true);
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:4000/api/debug/run-sync", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        loadToday();
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [currentFolder, setCurrentFolder] = useState("INBOX");
  const [selectedAccount, setSelectedAccount] = useState<string | null>("ALL");
  const [sourceMessages, setSourceMessages] = useState<DashboardMessage[]>([]);
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

  // FILTER BAR STATE
  const [activeFilter, setActiveFilter] = useState("TODAY");
  const [activeCategory, setActiveCategory] = useState("All");

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

  // Filtered messages by active filter
  useEffect(() => {
    if (!selectedAccount) return;
    setLoadingMessages(true);
    if (activeFilter === "TODAY") loadToday();
    else if (activeFilter === "YESTERDAY") loadYesterday();
    else if (activeFilter === "WEEK") loadWeek();
    else if (activeFilter === "MONTHLY") {
      // For the unified ALL inbox, loadAllInboxToday would be used for TODAY;
      // MOSTLY is independent of selectedAccount (works for USER-wide), but we respect selectedAccount
      if (selectedAccount === "ALL") {
        // we still call the unified /api/inbox/mostly
        loadMonthly();
      } else {
        // option: compute mostly for a single connected account (server route supports userId+filter)
        loadMonthly();
      }
    }
  }, [selectedAccount, currentFolder, activeFilter]);
  // FILTER LOADERS
  async function loadToday() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/inbox/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const emails = Array.isArray(data.emails)
      ? (data.emails as DashboardMessage[])
      : [];
    setLoadingMessages(false);
    const grouped = Object.values(
      emails.reduce<Record<string, DashboardMessage>>((acc, msg) => {
        const key = msg.threadId || msg._id || msg.id;
        if (!key) return acc;

        if (!acc[key]) {
          acc[key] = {
            ...msg,
            id: msg._id || msg.messageId || msg.id || key,
            count: 1,
          };
        } else {
          acc[key] = {
            ...acc[key],
            count: (acc[key].count || 0) + 1,
          };
        }

        return acc;
      }, {})
    ) as DashboardMessage[];
    // threadAttachmentCount will be fetched from /db/thread/:id
    grouped.forEach((t: any) => {
      delete t.threadAttachmentCount;
    });
    setSourceMessages(grouped);
    setMessages(
      activeCategory === "All"
        ? grouped
        : grouped.map(m => ({ ...m, hidden: m.category !== activeCategory }))
    );
  }

  async function loadYesterday() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/inbox/yesterday`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const emails = Array.isArray(data.emails)
      ? (data.emails as DashboardMessage[])
      : [];
    setLoadingMessages(false);
    const grouped = Object.values(
      emails.reduce<Record<string, DashboardMessage>>((acc, msg) => {
        const key = msg.threadId || msg._id || msg.id;
        if (!key) return acc;

        if (!acc[key]) {
          acc[key] = {
            ...msg,
            id: msg._id || msg.messageId || msg.id || key,
            count: 1,
          };
        } else {
          acc[key] = {
            ...acc[key],
            count: (acc[key].count || 0) + 1,
          };
        }

        return acc;
      }, {})
    ) as DashboardMessage[];
    // threadAttachmentCount will be fetched from /db/thread/:id
    grouped.forEach((t: any) => {
      delete t.threadAttachmentCount;
    });
    setSourceMessages(grouped);
    setMessages(
      activeCategory === "All"
        ? grouped
        : grouped.map(m => ({ ...m, hidden: m.category !== activeCategory }))
    );
  }

  async function loadWeek() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/inbox/week`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const emails = Array.isArray(data.emails)
      ? (data.emails as DashboardMessage[])
      : [];
    setLoadingMessages(false);
    const grouped = Object.values(
      emails.reduce<Record<string, DashboardMessage>>((acc, msg) => {
        const key = msg.threadId || msg._id || msg.id;
        if (!key) return acc;

        if (!acc[key]) {
          acc[key] = {
            ...msg,
            id: msg._id || msg.messageId || msg.id || key,
            count: 1,
          };
        } else {
          acc[key] = {
            ...acc[key],
            count: (acc[key].count || 0) + 1,
          };
        }

        return acc;
      }, {})
    ) as DashboardMessage[];
    // threadAttachmentCount will be fetched from /db/thread/:id
    grouped.forEach((t: any) => {
      delete t.threadAttachmentCount;
    });
    setSourceMessages(grouped);
    setMessages(
      activeCategory === "All"
        ? grouped
        : grouped.map(m => ({ ...m, hidden: m.category !== activeCategory }))
    );
  }

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
    // Always load from DB now for all accounts
    setLoadingThread(true);
    try {
      const token = localStorage.getItem("token");

      // Always load from DB now
      const res = await fetch(`${API_BASE}/api/db/thread/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("DB thread fetch failed");
      const data = await res.json();
      // console.log("this is data",data)
      setSelectedMessage(data);
      setSelectedThreadId(data.threadId || id);

    } catch (err) {
      console.error("DB thread load error:", err);
    } finally {
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
  
    // Extract name before <email>
    let name = fromField.split("<")[0].trim();
  
    // Remove quotes: "TaTT" → TaTT
    name = name.replace(/["']/g, "");
  
    // Find the first alphabetical character only
    const match = name.match(/[A-Za-z]/);
    if (match) return match[0].toUpperCase();
  
    // If no name available, fallback to email local-part
    const emailMatch = fromField.match(/^([^@]+)/);
    if (emailMatch && emailMatch[1]) {
      const emailInitial = emailMatch[1].match(/[A-Za-z]/);
      if (emailInitial) return emailInitial[0].toUpperCase();
    }
  
    // Default fallback
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
      const scrollKey =
        target.threadId || target.id || target._id || target.messageId;
      const targetId =
        selectedAccount === "ALL"
          ? target._id ?? target.messageId ?? target.id
          : target.id ?? target.messageId ?? target._id;

      if (!targetId) {
        console.warn("No identifier found for previous thread", target);
        return;
      }

      openMessage(targetId);
      if (scrollKey) scrollThreadIntoView(scrollKey);
    }
  }
  function goNextThread() {
    const key = getCurrentThreadKey();
    if (!key) return;
    const visible = getVisibleThreads();
    const idx = getSelectedIndex(visible);
    if (idx >= 0 && idx < visible.length - 1) {
      const target = visible[idx + 1];
      const scrollKey =
        target.threadId || target.id || target._id || target.messageId;
      const targetId =
        selectedAccount === "ALL"
          ? target._id ?? target.messageId ?? target.id
          : target.id ?? target.messageId ?? target._id;

      if (!targetId) {
        console.warn("No identifier found for next thread", target);
        return;
      }

      openMessage(targetId);
      if (scrollKey) scrollThreadIntoView(scrollKey);
    }
  }

  async function loadMonthly() {
    setLoadingMessages(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/inbox/monthly?limitSenders=8&lookbackDays=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const emails = Array.isArray(data.emails) ? data.emails : [];

      // Group by thread (or messageId) like other loaders
      const grouped = Object.values(
        emails.reduce((acc: any, msg: any) => {
          const key = msg.threadId || msg._id || msg.messageId || msg.id;
          if (!acc[key]) acc[key] = { ...msg, id: (msg._id || msg.messageId || msg.id), count: 1 };
          else acc[key].count++;
          return acc;
        }, {})
      );
      // threadAttachmentCount will be fetched from /db/thread/:id
      grouped.forEach((t: any) => {
        delete t.threadAttachmentCount;
      });
      setSourceMessages(grouped);
      setMessages(
        activeCategory === "All"
          ? grouped
          : grouped.map(m => ({ ...m, hidden: m.category !== activeCategory }))
      );
    } catch (err) {
      console.error("Load monthly error:", err);
    } finally {
      setLoadingMessages(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  function cleanSubject(subject?: string): string {
    if (!subject || typeof subject !== "string") return "(No Subject)";
  
    let text = subject.trim();
  
    // Remove ALL QUOTES: " ' ` “ ” ‘ ’
    text = text.replace(/["'`“”‘’]/g, "");
  
    // Remove emojis + weird symbols EXCEPT allowed characters
    text = text.replace(/[^\p{L}\p{N}\s\-'.(),!?&:]/gu, "");
  
    // Collapse multiple spaces
    text = text.replace(/\s+/g, " ");
  
    return text.trim() || "(No Subject)";
  }
  

  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!mounted) return null;

  // ✅ UI Layout
  return (
    
    <div className="flex h-screen text-gray-800 text-[14px] leading-tight">
      <AIBubbleChat 
        currentThreadId={selectedThreadId}
        currentSubject={selectedMessage?.messages?.[0]?.subject || "(No Subject)"}
    />
      {cmdOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-start justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-[480px] mt-24 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              type="text"
              placeholder="Search anything…"
              className="w-full px-4 py-3 rounded-xl bg-white/70 backdrop-blur border border-white/40 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setCmdOpen(false);
                }
              }}
            />
            <div className="mt-4 space-y-1 text-sm text-gray-700">
              <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
                🔍 Search emails
              </div>
              <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
                👤 Search senders
              </div>
              <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
                📎 Find attachments
              </div>
              <div className="px-3 py-2 hover:bg-white/40 rounded-lg cursor-pointer">
                ⚙️ Open settings
              </div>
            </div>
          </div>
        </div>
      )}
  {/* LEFT PANEL - Sidebar (Fixed Width) */}
  <aside className="w-[220px] ml-2 mt-2 mb-2 flex flex-col flex-shrink-0 overflow-hidden">
  
  {/* TOP LOGO */}
  <div className="px-4 pt-4 pb-2">
    <div className="flex items-center justify-between gap-2">
      <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
        S
      </div>
      <h1 className="text-lg font-bold tracking-tight text-gray-800">
        SIGMAMAIL
      </h1>
      <button
        onClick={handleSyncClick}
        disabled={isSyncing}
        className="px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
      >
        {isSyncing ? (
          <span className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></span>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 cursor-pointer font-semibold" />
          </>
        )}
      </button>
    </div>
  </div>


  {/* INBOX SECTION */}
  <div className="px-4 mt-6 mb-2">
    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
      Inbox
    </h3>

    <div
      onClick={() => {
        setSelectedAccount("ALL");
        setActiveFilter("TODAY");
        loadToday();
      }}
      className={`mt-3 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg transition-all border
        ${
          selectedAccount === "ALL"
            ? "bg-gray-200 border border-gray-100 text-black"
            : "border-transparent hover:bg-gray-100 text-gray-600"
        }
      `}
    >
      <Inbox className={`w-4 h-4 ${selectedAccount === "ALL" ? "text-blue-600" : "text-gray-500"}`} />
      <span className="text-[13.5px] font-medium">All Inbox</span>
    </div>
  </div>

  {/* SPACER */}
  <div className="flex-1"></div>

  {/* CONNECTED ACCOUNTS */}
  <button
      onClick={connectNewGmail}
      className="w-[200px] ml-2 cursor-pointer flex items-center justify-center gap-2 py-2 mb-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-600 transition"
    >
      Connect Mail
      <Plus className="w-4 h-4" />
      
    </button>
  <div className="px-4 pb-4">

    {/* Connect New Account Button */}
    

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
            className={`group relative flex items-center justify-between gap-2 px-2 py-2 rounded-lg cursor-default transition-all duration-200 ${
              selectedAccount === acc.email
                ? "bg-white shadow-sm text-gray-900 border border-gray-200"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-6 h-5 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-gray-600 text-[10px] font-bold uppercase">
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

    {/* Settings & Logout */}
    <div className="border-t border-gray-200 pt-3 space-y-1 mt-4">
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
      className="border mt-1 mr-0.5 mb-3 border-gray-100 bg-white flex flex-col overflow-x-hidden rounded-xl w-[470px]"
    >

  {/* Header */}
  <div className="border-b border-gray-200 px-5 py-3 sticky top-0 bg-white/80 backdrop-blur-md z-10">
    <div className="flex items-center gap-3 w-full">
      
      {/* SEARCH BAR (2/3 width) */}
      <div className="relative group w-full">
        <Search
          className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-600"
        />

        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1
                     px-2 py-[3px] rounded-md bg-gray-100/70 border border-gray-200/70
                     text-gray-500 text-[10px] shadow-sm"
        >
          <Command className="w-3 h-3" />
          <span className="text-[14px]">K</span>
        </div>

        <input
          type="text"
          placeholder="Search mail, people, subjects…"
          className="
            w-full
            pl-12 pr-16
            py-2.5
            text-sm
            bg-white
            border border-gray-300
            rounded-2xl
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500/50
            transition-all
            placeholder:text-gray-500
          "
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
  </div>




  {/* Filter Dropdown */}
  <div className="flex sticky bg-white z-10">
  <div className="px-3 py-3 w-1/3 sticky top-[56px] bg-white z-10">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] flex items-center justify-between">
          <span className="truncate">{activeFilter}</span>
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06-.02L10 10.94l3.71-3.75a.75.75 0 111.08 1.04l-4.25 4.3a.75.75 0 01-1.08 0L5.25 8.23a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 ml-24">
        <DropdownMenuRadioGroup value={activeFilter} onValueChange={(v) => setActiveFilter(v)}>
          <DropdownMenuRadioItem value="TODAY">Today</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="YESTERDAY">Yesterday</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="WEEK">This Week</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="MONTHLY">This Month</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  {/* Category Filter Dropdown */}
  <div className="px-3 py-3 w-1/3 sticky top-[56px] bg-white z-10">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] flex items-center justify-between">
          <span className="truncate">{activeCategory || "All Categories"}</span>
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06-.02L10 10.94l3.71-3.75a.75.75 0 111.08 1.04l-4.25 4.3a.75.75 0 01-1.08 0L5.25 8.23a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 ml-24">
        <DropdownMenuRadioGroup value={activeCategory} onValueChange={(cat) => {
          setActiveCategory(cat);
          setMessages(
            cat === "All"
              ? sourceMessages
              : sourceMessages.map(msg => ({
                  ...msg,
                  hidden: msg.category !== cat
                }))
          );
        }}>
          <DropdownMenuRadioItem value="All">All</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Work">Work</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Finance">Finance</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Bills">Bills</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Personal">Personal</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Travel">Travel</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Promotions">Promotions</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Updates">Updates</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Social">Social</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Shopping">Shopping</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Priority">Priority</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Spam">Spam</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  </div>

  {/* Email List */}
  <div className="flex-1 p-2 overflow-y-auto space-y-2">
    {loadingMessages && (
      <div className="p-7 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-800" />
      </div>
    )}
    {!loadingMessages && (
      <>
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
                onClick={() => {
                  const messageId =
                    selectedAccount === "ALL"
                      ? msg._id ?? msg.messageId ?? msg.id
                      : msg.id ?? msg.messageId ?? msg._id;

                  if (!messageId) {
                    console.warn("No identifier found for message", msg);
                    return;
                  }

                  openMessage(messageId);
                }}
                data-thread-id={
                  msg.threadId ||
                  (selectedAccount === "ALL"
                    ? (msg._id || msg.messageId || msg.id)
                    : (msg.id || msg.messageId || msg._id))
                }
                className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all rounded-lg ${
                  selectedThreadId === (msg.threadId || msg.id) ||
                  (selectedMessage?.messages?.some(
                    (m) =>
                      m.threadId === msg.threadId ||
                      m.id === msg.id ||
                      (selectedMessage?.threadId &&
                        selectedMessage.threadId === msg.threadId)
                  ) ?? false)
                    ? "bg-gray-100 border border-gray-100" 
                    : "bg-white border-l-transparent hover:bg-gray-50 hover:border-l-gray-300 hover:shadow-sm"
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 flex-shrink-0 rounded-full border border-gray-300 text-black flex items-center justify-center text-sm font-semibold uppercase shadow-sm">
                  {getAvatarInitial(msg.from)}
                </div>

                {/* Content */}
                <div className="flex-1 truncate min-w-0">
                  {/* Top Row: Sender, Badge, Date */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-gray-900 truncate">
                          {msg.from?.split("<")[0].trim() || "Unknown Sender"}
                        </h3>
                        {/* Priority or Bill Due badge */}
                        {msg.priority && (
                          <span className="px-2 py-0.5 text-[10px] font-medium text-purple-700 bg-purple-100 rounded-full flex-shrink-0">
                            Priority
                          </span>
                        )}
                        {msg.billDue && (
                          <span className="px-2 py-0.5 text-[10px] font-medium text-orange-700 bg-orange-100 rounded-full flex-shrink-0">
                            Bill Due
                          </span>
                        )}
                      </div>
                      {(msg.threadAttachmentCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-300 text-gray-700 rounded-full shadow-sm text-[11px] font-medium mr-2">
                          📎 {msg.threadAttachmentCount}
                        </div>
                      )}
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                        {formatDate(msg.date)}
                      </span>
                    </div>

                  {/* Subject */}
                  <p className="text-[12px] font-medium text-gray-500 truncate mb-1">
                  {cleanSubject(msg.subject) || "No Subject"}
                  </p>

                  {/* Bottom Row: Category tag + Account email + Attachments */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category badge (Work, Bills, Personal, etc.) */}
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        msg.category === "Work"
                          ? "bg-blue-100 text-blue-700"
                          : msg.category === "Finance"
                          ? "bg-green-100 text-green-700"
                          : msg.category === "Bills"
                          ? "bg-orange-100 text-orange-700"
                          : msg.category === "Personal"
                          ? "bg-purple-100 text-purple-700"
                          : msg.category === "Travel"
                          ? "bg-cyan-100 text-cyan-700"
                          : msg.category === "Promotions"
                          ? "bg-pink-100 text-pink-700"
                          : msg.category === "Updates"
                          ? "bg-gray-100 text-gray-700"
                          : msg.category === "Social"
                          ? "bg-yellow-100 text-yellow-700"
                          : msg.category === "Shopping"
                          ? "bg-emerald-100 text-emerald-700"
                          : msg.category === "Priority"
                          ? "bg-red-100 text-red-700"
                          : msg.category === "Spam"
                          ? "bg-red-200 text-red-900"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {msg.category || "General"}
                    </span>

                    {/* Account email with dot separator */}
                    <div className="flex items-center gap-1.5 text-xs rounded-xl bg-gray-50 border px-3 py-1 text-gray-500">
                      <span className="w-1 h-1 rounded-full bg-purple-500"></span>
                      <span className="max-w-[200px]">
                        {(msg.accountEmail || msg.to || "Unknown")
                          .replace(/\"/g, "")
                          .split("<")[0]
                          .trim()}
                      </span>
                    </div>


                    {(msg.attachments?.length ?? 0) > 0 && (
                      <div className="p-1.5 rounded-full bg-purple-100 flex items-center justify-center">
                        <Paperclip className="w-3 h-3 text-purple-600" />
                      </div>
                    )}

                    {/* Star icon (if starred) */}
                    {msg.starred && (
                      <svg className="w-4 h-4 text-yellow-500 fill-current ml-auto" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))
        )}

        {/* {nextPageToken && selectedAccount && (
          <button
            onClick={() => {
              const prevThread = selectedThreadId;
              loadMessages(selectedAccount, currentFolder, nextPageToken).then(() => {
                if (prevThread) setSelectedThreadId(prevThread);
              });
            }}
            className="w-full py-2 mt-3 text-sm text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200 transition"
          >
            Load more
          </button>
        )} */}
      </>
    )}
  </div>
</section>

    {/* RIGHT PANEL - Thread Viewer (Slides in/out) */}
    <section 
      className={`bg-white mt-1 mb-3 rounded-xl border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out w-[880px]`}
    >
      <div className="h-full overflow-y-auto">
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
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 200 200"
                className="w-40 h-40 text-blue-600"
              >
                <circle cx="100" cy="100" r="80" fill="#f8f9fa" />

                <ellipse cx="100" cy="145" rx="40" ry="10" fill="#e9ecef" />

                <rect
                  x="65"
                  y="55"
                  width="70"
                  height="90"
                  rx="10"
                  fill="#f1f3f5"
                  transform="rotate(-6 100 100)"
                />

                <rect
                  x="60"
                  y="50"
                  width="80"
                  height="100"
                  rx="12"
                  fill="white"
                  stroke="#dcdde1"
                  strokeWidth="1.5"
                  transform="rotate(6 100 100)"
                />

                <path
                  d="M75 70h30v20l-15 10-15-10z"
                  fill="none"
                  stroke="#adb5bd"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <rect x="75" y="100" width="50" height="6" rx="3" fill="#e9ecef" />
                <rect x="75" y="112" width="40" height="6" rx="3" fill="#e9ecef" />
                <rect x="75" y="124" width="30" height="6" rx="3" fill="#e9ecef" />
              </svg>
            <div className="text-xl font-semibold mb-2">It&apos;s empty here</div>
            <div className="text-sm">Choose an email to view details</div>
          </div>
        )}
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