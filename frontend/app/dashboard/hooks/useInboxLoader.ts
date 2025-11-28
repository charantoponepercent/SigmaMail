/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback } from "react";
import { API_BASE } from "@/lib/api";

export function useInboxLoader({
  setMessages,
  setSourceMessages,
  setLoadingMessages,
  activeCategory,
}) {
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
    async (endpoint: string) => {
      setLoadingMessages(true);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/inbox/${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        const emails = Array.isArray(data.emails) ? data.emails : [];

        const grouped = processEmails(emails);

        setSourceMessages(grouped);
        setMessages(
          activeCategory === "All"
            ? grouped
            : grouped.map((msg) => ({
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
  const loadToday = () => loadInbox("today");
  const loadYesterday = () => loadInbox("yesterday");
  const loadWeek = () => loadInbox("week");

  const loadMonthly = () =>
    loadInbox("monthly?limitSenders=8&lookbackDays=30");

  return {
    loadToday,
    loadYesterday,
    loadWeek,
    loadMonthly,
  };
}