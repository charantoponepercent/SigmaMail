/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback } from "react";
import { API_BASE } from "@/lib/api";

export function useInboxLoader({
  setMessages,
  setSourceMessages,
  setLoadingMessages,
  activeCategory,
}: {
  setMessages: (messages: any[]) => void;
  setSourceMessages: (messages: any[]) => void;
  setLoadingMessages: (loading: boolean) => void;
  activeCategory: string;
}) {
  const shouldScopeToAccount = (selectedAccount?: string | null) => {
    const normalized = (selectedAccount || "").trim();
    if (!normalized) return false;
    if (normalized.toUpperCase() === "ALL") return false;
    if (normalized.startsWith("__")) return false;
    return true;
  };

  const buildQueryString = (parts: string[]) => {
    const q = parts.filter(Boolean).join("&");
    return q ? `?${q}` : "";
  };

  // Helper to process inbox responses (group by thread)
  const processEmails = useCallback(
    (emails: any[]) => {
      const grouped = Object.values(
        emails.reduce((acc: any, msg: any) => {
          const key = msg.threadId || msg._id || msg.id;
          if (!key) return acc;

          // First entry for that thread
          if (!acc[key]) {
            acc[key] = {
              ...msg,
              id: msg._id || msg.messageId || msg.id || key,
              count: 1,
            };
          } else {
            // Already exists → increase count
            acc[key].count++;
          }

          return acc;
        }, {})
      );

      // remove threadAttachmentCount since actual viewer loads from DB
      grouped.forEach((t: any) => {
        delete t.threadAttachmentCount;
      });

      return grouped;
    },
    []
  );

  // Generic loader
  const loadInbox = useCallback(
    async (endpoint: string, force = false, query: string = "") => {
      setLoadingMessages(true);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/inbox/${endpoint}${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const emails = Array.isArray(data.emails) ? data.emails : [];

        const grouped = processEmails(emails);

        if (force) {
          setSourceMessages(grouped);
          setMessages(
            activeCategory === "All"
              ? grouped
              : grouped.map((msg: any) => ({
                  ...msg,
                  hidden: msg.category !== activeCategory,
                }))
          );
          return;
        }

        // Source of truth
        setSourceMessages(grouped);

        // Apply category filtering
        setMessages(
          activeCategory === "All"
            ? grouped
            : grouped.map((msg: any) => ({
                ...msg,
                hidden: msg.category !== activeCategory,
              }))
        );
      } catch (err) {
        console.error(`❌ Inbox load failed (${endpoint})`, err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [activeCategory, setMessages, setSourceMessages, setLoadingMessages, processEmails]
  );

  // Public loaders
  const loadToday = (
    force = false,
    decisionType?: string,
    selectedAccount?: string | null
  ) => {
    const parts: string[] = [];
    if (decisionType) {
      parts.push(`decision=${encodeURIComponent(decisionType)}`);
      parts.push("scope=today");
    }
    if (shouldScopeToAccount(selectedAccount)) {
      parts.push(`account=${encodeURIComponent((selectedAccount || "").trim())}`);
    }
    const query = buildQueryString(parts);
    return loadInbox("today", force, query);
  };

  const loadYesterday = (force = false, selectedAccount?: string | null) => {
    const parts: string[] = [];
    if (shouldScopeToAccount(selectedAccount)) {
      parts.push(`account=${encodeURIComponent((selectedAccount || "").trim())}`);
    }
    return loadInbox("yesterday", force, buildQueryString(parts));
  };

  const loadWeek = (force = false, selectedAccount?: string | null) => {
    const parts: string[] = [];
    if (shouldScopeToAccount(selectedAccount)) {
      parts.push(`account=${encodeURIComponent((selectedAccount || "").trim())}`);
    }
    return loadInbox("week", force, buildQueryString(parts));
  };

  const loadMonthly = (force = false, selectedAccount?: string | null) => {
    const parts = ["limitSenders=8", "lookbackDays=30"];
    if (shouldScopeToAccount(selectedAccount)) {
      parts.push(`account=${encodeURIComponent((selectedAccount || "").trim())}`);
    }
    return loadInbox("monthly", force, buildQueryString(parts));
  };

  return {
    loadToday,
    loadYesterday,
    loadWeek,
    loadMonthly,
  };
}
