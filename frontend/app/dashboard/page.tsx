/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
// 🔵 Debounce helper (prevents API on each keystroke)
function debounce(fn: any, delay: number) {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import DisconnectDialog from "@/components/DisconnectDialog";
import ThreadViewer from "@/components/ThreadViewer";
import ThreadSkeleton from './ThreadSkeleton.js'
import AIBubbleChat from "@/components/AIBubbleChat";
import SearchCommandPalette from "./components/layout/SearchCommandPalette";
import EmailListItem from './components/EmailListItem'


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
import SearchBar from "./components/SearchBar";
import Sidebar from "./components/Sidebar";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);  
  const [accountToDisconnect, setAccountToDisconnect] = useState<string | null>(
    null
  );

  // FILTER BAR STATE
  const [activeFilter, setActiveFilter] = useState("TODAY");
  const [activeCategory, setActiveCategory] = useState("All");
  const handleCmdSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.trim();
  
    if (!q) {
      setMessages(sourceMessages);
      return;
    }
  
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE.replace("/api", "")}/search_api/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: q, mode: "semantic" })
      });
  
      const data = await res.json();
      const raw = data.results || [];
  
      // 1️⃣ extract the email object
      const emails = raw.map((r: any) => r.email);
  
      // 2️⃣ group by thread like inbox
      const grouped = Object.values(
        emails.reduce((acc: any, msg: any) => {
          const key = msg.threadId || msg._id || msg.messageId;
          if (!key) return acc;
  
          if (!acc[key]) {
            acc[key] = {
              ...msg,
              id: msg._id || msg.messageId || key,
              count: 1,
              hidden: false
            };
          } else {
            acc[key].count++;
          }
  
          return acc;
        }, {})
      );
  
      // 3️⃣ sort by highest semantic score
      grouped.sort((a: any, b: any) => {
        const scoreA = raw.find((r: any) => r.email._id === a._id)?.score || 0;
        const scoreB = raw.find((r: any) => r.email._id === b._id)?.score || 0;
        return scoreB - scoreA;
      });
  
      // 4️⃣ update inbox view
      setMessages(grouped);
  
    } catch (err) {
      console.error("🔍 Semantic search error:", err);
    }
  };


  const debouncedSearch = useCallback(
    debounce((e: React.ChangeEvent<HTMLInputElement>) => {
      handleCmdSearch(e);
    }, 300),
    []
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
        currentThreadId={selectedThreadId ?? undefined}
        currentSubject={selectedMessage?.messages?.[0]?.subject || "(No Subject)"}
      />
      <SearchCommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onSearchChange={debouncedSearch}
      />
      <Sidebar
        isSyncing={isSyncing}
        accounts={accounts}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        handleSyncClick={handleSyncClick}
        connectNewGmail={connectNewGmail}
        logout={logout}
        setShowDialog={setShowDialog}
        setAccountToDisconnect={setAccountToDisconnect}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 m-1 flex overflow-hidden">
        <section className="border mt-1 mr-0.5 mb-3 border-gray-100 bg-white flex flex-col overflow-x-hidden rounded-xl w-[470px]">
          <div className="border-b border-gray-200 px-5 py-3 sticky top-0 bg-white/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-3 w-full">
              <SearchBar onChange={debouncedSearch} />   
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
                    .map((msg) => (
                      <EmailListItem
                        key={msg.threadId || msg._id || msg.id}
                        msg={msg}
                        selected={selectedThreadId === (msg.threadId || msg._id || msg.id)}
                        onClick={() => {
                          const id = msg.threadId || msg._id || msg.id;
                          setSelectedThreadId(id);
                          openMessage(id);
                        }}
                        cleanSubject={cleanSubject}
                        getAvatarInitial={getAvatarInitial}
                        formatDate={formatDate}
                      />
                    ))
                )}
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