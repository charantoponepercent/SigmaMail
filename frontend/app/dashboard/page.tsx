/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import DisconnectDialog from "@/components/DisconnectDialog";
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
import OrchestratorStatusPanel from "./components/OrchestratorStatusPanel";
import ThreadSummaryPanel from "./components/ThreadSummaryPanel";
import { DashboardMessage, DashboardThread } from "./types";

type DashboardUser = { id: string; name: string };
type DashboardAccount = { _id: string; email: string };
type OrchestratorStatusItem = {
  at: string;
  task: string;
  strategy: string;
  confidence: number | null;
  model: string | null;
  latencyMs: number | null;
  cached?: boolean;
  error?: string | null;
};
export default function Dashboard() {
  const router = useRouter();
  const DEBUG_REALTIME = true;

  // const [labelCounts, setLabelCounts] = useState<any>({});
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncClick() {
    try {
      setIsSyncing(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/debug/run-sync`, {
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
      setSelectedAccount((prev) =>
        prev || (data.accounts && data.accounts.length > 0 ? data.accounts[0].email : prev)
      );
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, []);
  const [sourceMessages, setSourceMessages] = useState<DashboardMessage[]>([]);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [selectedMessage, setSelectedMessage] =
    useState<DashboardThread | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);  
  const [accountToDisconnect, setAccountToDisconnect] = useState<string | null>(
    null
  );
  
  // FILTER BAR STATE
  const [activeFilter, setActiveFilter] = useState("TODAY");
  const [activeCategory, setActiveCategory] = useState("All");
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestText, setDigestText] = useState<any>("");
  const [digestLoading, setDigestLoading] = useState(false);
  const [orchestratorOpen, setOrchestratorOpen] = useState(false);
  const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatusItem[]>([]);
  const [orchestratorLoading, setOrchestratorLoading] = useState(false);
  const [threadSummaryOpen, setThreadSummaryOpen] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const activeFilterRef = useRef(activeFilter);
  const selectedAccountRef = useRef<string | null>(selectedAccount);

  // Added new mail notification state and timer ref
  const [newMailCount, setNewMailCount] = useState(0);
  const [showNewTag, setShowNewTag] = useState(false);
  const newMailTimerRef = useRef<NodeJS.Timeout | null>(null);

  const applyCategoryLocallyBulk = useCallback((emailIds: string[], category: string) => {
    const idSet = new Set((emailIds || []).filter(Boolean));
    if (idSet.size === 0) return;

    const patchMessage = (msg: DashboardMessage) => {
      const msgId = msg._id || msg.id;
      if (!msgId || !idSet.has(msgId)) return msg;
      return { ...msg, category };
    };

    setMessages((prev) => prev.map(patchMessage));
    setSourceMessages((prev) => prev.map(patchMessage));
    setSelectedMessage((prev) => {
      if (!prev?.messages) return prev;
      return {
        ...prev,
        messages: prev.messages.map((msg: DashboardMessage) => {
          const msgId = msg._id || msg.id;
          if (!msgId || !idSet.has(msgId)) return msg;
          return { ...msg, category };
        }),
      };
    });
  }, []);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

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
  const loadTodayRef = useRef(loadToday);
  const loadYesterdayRef = useRef(loadYesterday);
  const loadWeekRef = useRef(loadWeek);
  const loadMonthlyRef = useRef(loadMonthly);

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);

  useEffect(() => {
    loadTodayRef.current = loadToday;
    loadYesterdayRef.current = loadYesterday;
    loadWeekRef.current = loadWeek;
    loadMonthlyRef.current = loadMonthly;
  }, [loadToday, loadYesterday, loadWeek, loadMonthly]);

  const refreshActiveInbox = useCallback((force = true, reason = "unknown") => {
    const currentAccount = selectedAccountRef.current;
    if (!currentAccount) return;
    if (DEBUG_REALTIME) {
      console.log("[Realtime] refreshActiveInbox", {
        reason,
        force,
        activeFilter: activeFilterRef.current,
        account: currentAccount,
      });
    }

    if (activeFilterRef.current === "TODAY") {
      const decisionMap: Record<string, string> = {
        "__NEEDS_REPLY__": "NEEDS_REPLY",
        "__DEADLINES_TODAY__": "DEADLINES_TODAY",
        "__OVERDUE_FOLLOWUPS__": "OVERDUE_FOLLOWUPS",
      };
      const decisionType =
        currentAccount && decisionMap[currentAccount]
          ? decisionMap[currentAccount]
          : undefined;
      loadTodayRef.current(force, decisionType, currentAccount);
    } else if (activeFilterRef.current === "YESTERDAY") {
      loadYesterdayRef.current(force, currentAccount);
    } else if (activeFilterRef.current === "WEEK") {
      loadWeekRef.current(force, currentAccount);
    } else if (activeFilterRef.current === "MONTHLY") {
      loadMonthlyRef.current(force, currentAccount);
    }
  }, []);

  const { loadingThread, openMessage, closeThread } = useThreadLoader({
    setSelectedMessage,
    setSelectedThreadId,
  });

  const {
    searchQuery,
    searchMode,
    searchMeta,
    previewItems,
    clearSearch,
    onSearchChange,
    onSearchKeyDown,
    onModeChange,
    onPreviewSelect,
  } = useSearch({
    setMessages,
    sourceMessages,
    activeCategory,
    setSearchLoading,
    openMessage,
  });

  const { goPrevThread, goNextThread } = useThreadNavigation({
    messages,
    selectedMessage,
    selectedThreadId,
    selectedAccount,
    openMessage,
  });

  const onCategoryFeedback = useCallback(async (emailId: string, category: string) => {
    const shouldApply = window.confirm(
      `Change category to "${category}" and apply to related emails from same sender/content keywords?`
    );
    if (!shouldApply) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/api/emails/${emailId}/category-feedback`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        method: "POST",
        body: JSON.stringify({ category, applyRelated: true }),
      });

      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore non-JSON body
        }
        throw new Error(message);
      }

      const data = await res.json();
      const relatedIds = Array.isArray(data?.relatedEmailIds) ? data.relatedEmailIds : [];
      const mergedIds = Array.from(new Set([emailId, ...relatedIds]));
      applyCategoryLocallyBulk(mergedIds, category);
    } catch (err) {
      console.error("Category feedback failed:", err);
      if (activeFilter === "TODAY") loadToday(true);
      if (activeFilter === "YESTERDAY") loadYesterday(true);
      if (activeFilter === "WEEK") loadWeek(true);
      if (activeFilter === "MONTHLY") loadMonthly(true);
    }
  }, [activeFilter, applyCategoryLocallyBulk, loadMonthly, loadToday, loadWeek, loadYesterday]);

  const loadOrchestratorStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setOrchestratorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/orchestrator-status?limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const latestByTask: OrchestratorStatusItem[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const task = typeof item?.task === "string" ? item.task : "unknown";
        if (seen.has(task)) continue;
        seen.add(task);
        latestByTask.push(item);
      }
      setOrchestratorStatus(latestByTask);
    } catch (err) {
      console.error("Failed to load orchestrator status:", err);
    } finally {
      setOrchestratorLoading(false);
    }
  }, []);

  const clearOrchestratorStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/ai/orchestrator-status`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrchestratorStatus([]);
    } catch (err) {
      console.error("Failed to clear orchestrator status:", err);
    }
  }, []);


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
    // 🔔 Start SSE inbox stream
    if (!sseRef.current) {
      const es = new EventSource(
        `${API_BASE}/api-sse/sse/inbox?userId=${parsed.id}`
      );

      es.onmessage = (event) => {
        let payload: any = null;
        try {
          payload = JSON.parse(event.data);
        } catch (err) {
          console.error("Invalid SSE payload:", err);
          return;
        }

        const eventType =
          payload?.type ||
          (typeof payload?.data?.isRead === "boolean"
            ? "EMAIL_READ_STATE"
            : "NEW_EMAIL");

        if (DEBUG_REALTIME) {
          console.log("[Realtime] SSE message", {
            eventType,
            payload,
          });
        }

        if (eventType === "NEW_EMAIL") {
          setNewMailCount((c) => c + 1);
          setShowNewTag(true);

          if (newMailTimerRef.current) {
            clearTimeout(newMailTimerRef.current);
          }
          newMailTimerRef.current = setTimeout(() => {
            setShowNewTag(false);
            setNewMailCount(0);
          }, 2 * 60 * 1000); // 2 minutes

          refreshActiveInbox(true, "sse:new-email");
        }

        if (eventType === "EMAIL_READ_STATE") {
          const payloadId = String(payload?.data?.emailId || "");
          if (!payloadId) return;
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id || m.id || "") === payloadId
                ? { ...m, isRead: payload.data.isRead }
                : m
            )
          );

          setSourceMessages((prev) =>
            prev.map((m) =>
              String(m._id || m.id || "") === payloadId
                ? { ...m, isRead: payload.data.isRead }
                : m
            )
          );
        }
      };

      es.onerror = (err) => {
        console.error("SSE inbox stream error:", err);
      };

      es.onopen = () => {
        if (DEBUG_REALTIME) {
          console.log("[Realtime] SSE connected");
        }
      };

      sseRef.current = es;
    }
    loadAccounts(token);
    loadOrchestratorStatus();
  }, [router, loadAccounts, loadOrchestratorStatus, refreshActiveInbox]);

  // Helper: Is selectedAccount a special Today’s Decisions filter?
  function isDecisionFilter(account: string | null) {
    return (
      account === "__NEEDS_REPLY__" ||
      account === "__DEADLINES_TODAY__" ||
      account === "__OVERDUE_FOLLOWUPS__"
    );
  }

  useEffect(() => {
    if (!selectedAccount) return;

    // 🧠 Today’s Decisions routing (temporary)
    if (isDecisionFilter(selectedAccount)) {
      setActiveFilter("TODAY");
      setLoadingMessages(true);

      const decisionMap: Record<string, string> = {
        "__NEEDS_REPLY__": "NEEDS_REPLY",
        "__DEADLINES_TODAY__": "DEADLINES_TODAY",
        "__OVERDUE_FOLLOWUPS__": "OVERDUE_FOLLOWUPS",
      };

      loadToday(true, decisionMap[selectedAccount], selectedAccount);
      return;
    }

    setLoadingMessages(true);

    if (activeFilter === "TODAY") {
      loadToday(false, undefined, selectedAccount);
    } else if (activeFilter === "YESTERDAY") {
      loadYesterday(false, selectedAccount);
    } else if (activeFilter === "WEEK") {
      loadWeek(false, selectedAccount);
    } else if (activeFilter === "MONTHLY") {
      loadMonthly(false, selectedAccount);
    }
  }, [selectedAccount, activeFilter]);


  function connectNewGmail() {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const params = new URLSearchParams();
    if (u?.id) params.set("userId", u.id);
    if (u?.email) params.set("userEmail", u.email);
    const qs = params.toString();
    if (!qs) {
      alert("Missing user session. Please log in again.");
      return;
    }
    const url = `${API_BASE}/auth/google?${qs}`;
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
      if (data && typeof data === "object") setDigestText(data);
      else setDigestText("No digest generated.");
    } catch (err) {
      console.error("Digest error:", err);
      setDigestText("Failed to generate daily digest.");
    } finally {
      setDigestLoading(false);
      loadOrchestratorStatus();
    }
  }

  function showOrchestrator() {
    setOrchestratorOpen(true);
    loadOrchestratorStatus();
  }

  function showThreadSummary() {
    setThreadSummaryOpen(true);
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

  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (newMailTimerRef.current) {
        clearTimeout(newMailTimerRef.current);
        newMailTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOrchestratorStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadOrchestratorStatus]);

  if (!mounted) return null;
  // ✅ UI Layout
  return (
    
    <div className="flex h-screen text-gray-800 text-[14px] leading-tight">
      <SearchCommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        query={searchQuery}
        mode={searchMode}
        loading={searchLoading}
        meta={searchMeta}
        results={previewItems}
        onQueryChange={onSearchChange}
        onModeChange={onModeChange}
        onSearchKeyDown={onSearchKeyDown}
        onSelectResult={onPreviewSelect}
        onClear={clearSearch}
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
        onShowOrchestrator={showOrchestrator}
        onShowThreadSummary={showThreadSummary}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 m-1 flex overflow-hidden">
        <section className="border mt-1 mr-0.5 mb-3 border-gray-100 bg-white flex flex-col overflow-x-hidden rounded-xl flex-shrink-0 w-[510px]">
          <HeaderBar
            searchQuery={searchQuery}
            searchMode={searchMode}
            searchMeta={searchMeta}
            onSearchChange={onSearchChange}
            onSearchModeChange={onModeChange}
            onSearchClear={clearSearch}
            onSearchKeyDown={onSearchKeyDown}
          />
          {/* Filter Dropdown */}
          <DropFilterBar
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            sourceMessages={sourceMessages}
            setMessages={setMessages}
          />

          {showNewTag && (
            <div className="mx-3 my-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-600" />
              <span>{newMailCount} new mail{newMailCount > 1 ? "s" : ""}</span>
            </div>
          )}

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
          onCategoryFeedback={onCategoryFeedback}
          onClose={closeThread}
        />
      </div>

      <DigestModal
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        digestText={digestText}
        loading={digestLoading}
      />

      <OrchestratorStatusPanel
        open={orchestratorOpen}
        onClose={() => setOrchestratorOpen(false)}
        items={orchestratorStatus}
        loading={orchestratorLoading}
        onRefresh={loadOrchestratorStatus}
        onClear={clearOrchestratorStatus}
      />

      <ThreadSummaryPanel
        open={threadSummaryOpen}
        onClose={() => setThreadSummaryOpen(false)}
        threadId={selectedThreadId}
        threadSubject={
          selectedMessage?.messages && selectedMessage.messages.length > 0
            ? selectedMessage.messages[selectedMessage.messages.length - 1]?.subject || "(No Subject)"
            : "(No Subject)"
        }
        messageCount={selectedMessage?.messages?.length || 0}
        accountEmail={selectedMessage?.account || selectedMessage?.messages?.[0]?.accountEmail || null}
        onRunComplete={loadOrchestratorStatus}
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
