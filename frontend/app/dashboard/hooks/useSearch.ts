"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { DashboardMessage } from "../types";

export type SearchMode = "hybrid" | "semantic" | "keyword";

export type SearchMeta = {
  modeUsed: SearchMode;
  totalCandidates: number;
  totalResults: number;
  latencyMs: number;
};

export type SearchPreviewItem = {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  date?: string;
  score: number;
  why: string[];
};

type RawSearchRow = {
  email?: DashboardMessage;
  score?: number;
  semanticScore?: number;
  lexicalScore?: number;
  matchedCount?: number;
  why?: string[];
};

type UseSearchArgs = {
  setMessages: React.Dispatch<React.SetStateAction<DashboardMessage[]>>;
  sourceMessages: DashboardMessage[];
  activeCategory: string;
  setSearchLoading: React.Dispatch<React.SetStateAction<boolean>>;
  openMessage: (id: string) => void;
};

function applyCategoryFilter(messages: DashboardMessage[], activeCategory: string): DashboardMessage[] {
  if (activeCategory === "All") return messages.map((m) => ({ ...m, hidden: false }));
  return messages.map((m) => ({
    ...m,
    hidden: m.category !== activeCategory,
  }));
}

function normalizeSearchRows(rows: RawSearchRow[]): DashboardMessage[] {
  return rows
    .map((row) => {
      const email = row.email || ({} as DashboardMessage);
      const id = String(email.threadId || email._id || email.messageId || email.id || "");
      if (!id) return null;

      return {
        ...email,
        id,
        count: Number(email.count || row.matchedCount || 1),
        matchedCount: Number(email.matchedCount || row.matchedCount || 1),
        searchScore: typeof row.score === "number" ? row.score : email.searchScore,
        semanticScore: typeof row.semanticScore === "number" ? row.semanticScore : email.semanticScore,
        lexicalScore: typeof row.lexicalScore === "number" ? row.lexicalScore : email.lexicalScore,
        searchWhy: Array.isArray(row.why) ? row.why : email.searchWhy || [],
        hidden: false,
      } as DashboardMessage;
    })
    .filter((m): m is DashboardMessage => Boolean(m));
}

export function useSearch({
  setMessages,
  sourceMessages,
  activeCategory,
  setSearchLoading,
  openMessage,
}: UseSearchArgs) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [previewItems, setPreviewItems] = useState<SearchPreviewItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restoreInbox = useCallback(() => {
    setMessages(applyCategoryFilter(sourceMessages, activeCategory));
    setMeta(null);
    setPreviewItems([]);
  }, [activeCategory, setMessages, sourceMessages]);

  const runSearch = useCallback(
    async (nextQuery: string, nextMode: SearchMode = mode) => {
      const trimmed = nextQuery.trim();
      setQuery(nextQuery);

      if (!trimmed) {
        restoreInbox();
        return;
      }

      setSearchLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/search_api/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: trimmed,
            mode: nextMode,
            limit: 60,
            maxCandidates: 2200,
            daysBack: 240,
          }),
        });

        const data = await res.json();
        const rawRows: RawSearchRow[] = Array.isArray(data?.results) ? data.results : [];
        const normalized = normalizeSearchRows(rawRows);
        const filtered = applyCategoryFilter(normalized, activeCategory);
        setMessages(filtered);

        const backendMeta = data?.meta || {};
        setMeta({
          modeUsed: (data?.modeUsed || nextMode) as SearchMode,
          totalCandidates: Number(backendMeta.totalCandidates || 0),
          totalResults: Number(backendMeta.totalResults || normalized.length),
          latencyMs: Number(backendMeta.latencyMs || 0),
        });

        setPreviewItems(
          normalized.slice(0, 8).map((item) => ({
            id: item.id,
            threadId: item.threadId,
            subject: item.subject || "(No subject)",
            from: item.from || "Unknown sender",
            date: item.date,
            score: Number(item.searchScore || 0),
            why: Array.isArray(item.searchWhy) ? item.searchWhy : [],
          }))
        );
      } catch (err) {
        console.error("Search error:", err);
        restoreInbox();
      } finally {
        setSearchLoading(false);
      }
    },
    [activeCategory, mode, restoreInbox, setMessages, setSearchLoading]
  );

  const onSearchChange = useCallback(
    (nextQuery: string) => {
      setQuery(nextQuery);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!nextQuery.trim()) {
        restoreInbox();
        return;
      }

      debounceRef.current = setTimeout(() => {
        runSearch(nextQuery, mode);
      }, 260);
    },
    [mode, restoreInbox, runSearch]
  );

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const typed = (e.target as HTMLInputElement).value || query;
        runSearch(typed, mode);
      }
      if (e.key === "Escape") {
        setQuery("");
        restoreInbox();
      }
    },
    [mode, query, restoreInbox, runSearch]
  );

  const onModeChange = useCallback(
    (nextMode: SearchMode) => {
      setMode(nextMode);
      if (query.trim()) {
        runSearch(query, nextMode);
      }
    },
    [query, runSearch]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    restoreInbox();
  }, [restoreInbox]);

  const onPreviewSelect = useCallback(
    (id: string) => {
      if (!id) return;
      openMessage(id);
    },
    [openMessage]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    searchQuery: query,
    searchMode: mode,
    searchMeta: meta,
    previewItems,
    runSearch,
    clearSearch,
    onSearchChange,
    onSearchKeyDown,
    onModeChange,
    onPreviewSelect,
  };
}
