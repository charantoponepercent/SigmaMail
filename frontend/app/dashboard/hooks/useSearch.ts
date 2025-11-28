"use client";

import { useCallback, useRef } from "react";
import { API_BASE } from "@/lib/api";

export function useSearch({ setMessages, sourceMessages, activeCategory, setSearchLoading }) {

  // Store ONE stable debounced function across renders
  const debounceRef = useRef<any>(null);

  // Main API search function (does not change between renders)
  const runSearch = useCallback(
    async (query: string) => {
      console.log("🔍 runSearch triggered with query:", query);
      setSearchLoading(true);
      if (!query) {
        console.log("⚠ Empty query received. Restoring inbox...");
        setMessages(
          activeCategory === "All"
            ? sourceMessages
            : sourceMessages.map((msg) => ({
                ...msg,
                hidden: msg.category !== activeCategory,
              }))
        );
        setSearchLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");

        console.log("🌐 Sending search request to backend...");
        const res = await fetch(`${API_BASE}/search_api/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        const data = await res.json();
        console.log("📥 Backend search response received:", data);
        const raw = data.results || [];
        const emails = raw.map((r: any) => r.email);

        const grouped = Object.values(
          emails.reduce((acc: any, msg: any) => {
            const key = msg.threadId || msg._id || msg.messageId;
            if (!key) return acc;

            if (!acc[key]) {
              acc[key] = {
                ...msg,
                id: msg._id || msg.messageId || key,
                count: 1,
                hidden: false,
              };
            } else {
              acc[key].count++;
            }

            return acc;
          }, {})
        );

        grouped.sort((a: any, b: any) => {
          const scoreA =
            raw.find((r: any) => r.email._id === a._id)?.score || 0;
          const scoreB =
            raw.find((r: any) => r.email._id === b._id)?.score || 0;
          return scoreB - scoreA;
        });

        setMessages(grouped);
      } catch (err) {
        console.error("❌ Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    },
    [setMessages, sourceMessages, activeCategory, setSearchLoading]
  );

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        console.log("⏎ Enter pressed in SearchBar, running search...");
        const q = (e.target as HTMLInputElement).value.trim();
        runSearch(q);
      }
    },
    [runSearch]
  );

  return { onSearchKeyDown };
}