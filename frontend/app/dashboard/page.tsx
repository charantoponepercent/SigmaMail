/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import DisconnectDialog from "@/components/DisconnectDialog";
import AIBubbleChat from "@/components/AIBubbleChat";
import SearchCommandPalette from "./components/layout/SearchCommandPalette";
import { useInboxLoader } from "./hooks/useInboxLoader";
import { useSearch } from "./hooks/useSearch";
import DropFilterBar from "./components/DropFilterBar";
import EmailList from "./components/EmailList";
import { useThreadNavigation } from "./hooks/useThreadNavigation";
import HeaderBar from "./components/HeaderBar";
import Sidebar from "./components/Sidebar";
import ThreadPanel from "./components/ThreadPanel";
import { formatDate, cleanSubject, getAvatarInitial } from "./components/utils/mailUtils";
import { useThreadLoader } from "./hooks/useThreadLoader";
import DigestModal from "./components/DigestModal";

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
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>("ALL");
  // Restore loadAccounts (required after removing useAccountManager)
  const loadAccounts = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAccounts(data.accounts || []);
      // Auto-select first account if none selected
      if (data.accounts && data.accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(data.accounts[0].email);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, [selectedAccount]);
  const [currentFolder, setCurrentFolder] = useState("INBOX");
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
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestText, setDigestText] = useState("");
  const [digestLoading, setDigestLoading] = useState(false);


  const {
    loadToday,
    loadYesterday,
    loadWeek,
    loadMonthly,
  } = useInboxLoader({
    setMessages,
    setSourceMessages,
    setLoadingMessages,
    activeCategory,
  });

  const { onSearchKeyDown } = useSearch({
    setMessages,
    sourceMessages,
    activeCategory,
    setSearchLoading,
  });

  const { loadingThread, openMessage, closeThread } = useThreadLoader({
    setSelectedMessage,
    setSelectedThreadId,
  });

  const { goPrevThread, goNextThread } = useThreadNavigation({
    messages,
    selectedMessage,
    selectedThreadId,
    selectedAccount,
    openMessage,
  });


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

  // Filter-based inbox loading
  useEffect(() => {
    if (!selectedAccount) return;
    setLoadingMessages(true);

    if (activeFilter === "TODAY") {
      loadToday();
    } else if (activeFilter === "YESTERDAY") {
      loadYesterday();
    } else if (activeFilter === "WEEK") {
      loadWeek();
    } else if (activeFilter === "MONTHLY") {
      loadMonthly();
    }
  }, [selectedAccount, activeFilter]);


  function connectNewGmail() {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const url = `${API_BASE}/auth/google?userId=${u.id}`;
    window.open(url, "_blank", "width=800,height=700");
  }

  async function showDigest() {
    setDigestOpen(true);
    setDigestLoading(true);
    setDigestText("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/ai/daily-digest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.summary) {
        setDigestText(data.summary);
      } else {
        setDigestText("No digest generated.");
      }
    } catch (err) {
      console.error("Digest error:", err);
      setDigestText("Failed to generate daily digest.");
    } finally {
      setDigestLoading(false);
    }
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

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
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
        onSearchKeyDown={onSearchKeyDown}
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
        onShowDigest={showDigest}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 m-1 flex overflow-hidden">
        <section className="border mt-1 mr-0.5 mb-3 border-gray-100 bg-white flex flex-col overflow-x-hidden rounded-xl w-[470px]">
          <HeaderBar onSearchKeyDown={onSearchKeyDown} />
          {/* Filter Dropdown */}
          <DropFilterBar
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            sourceMessages={sourceMessages}
            setMessages={setMessages}
          />

          {/* Email List */}
          <EmailList
            messages={messages}
            loadingMessages={loadingMessages}
            searchLoading={searchLoading}
            selectedThreadId={selectedThreadId}
            openMessage={openMessage}
            cleanSubject={cleanSubject}
            getAvatarInitial={getAvatarInitial}
            formatDate={formatDate}
            selectedAccount={selectedAccount}
          />
        </section>

        {/* RIGHT PANEL - Thread Viewer (Slides in/out) */}
        <ThreadPanel
          loadingThread={loadingThread}
          selectedMessage={selectedMessage}
          selectedThreadId={selectedThreadId}
          goPrevThread={goPrevThread}
          goNextThread={goNextThread}
          onClose={closeThread}
        />
      </div>

      <DigestModal
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        digestText={digestText}
        loading={digestLoading}
      />

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