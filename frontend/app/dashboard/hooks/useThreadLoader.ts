"use client";

import { useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { DashboardThread } from "../types";

type UseThreadLoaderArgs = {
  setSelectedMessage: (thread: DashboardThread | null) => void;
  setSelectedThreadId: (threadId: string | null) => void;
};

export function useThreadLoader({
  setSelectedMessage,
  setSelectedThreadId,
}: UseThreadLoaderArgs) {
  const [loadingThread, setLoadingThread] = useState(false);

  const openMessage = useCallback(async (id: string) => {
    setLoadingThread(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/db/thread/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Thread fetch failed");
      const data = await res.json();

      setSelectedMessage(data);
      setSelectedThreadId(data.threadId || id);
    } catch (err) {
      console.error("❌ Thread load error:", err);
    } finally {
      setLoadingThread(false);
    }
  }, [setSelectedMessage, setSelectedThreadId]);

  const closeThread = useCallback(() => {
    setSelectedMessage(null);
    setSelectedThreadId(null);
  }, [setSelectedMessage, setSelectedThreadId]);

  return {
    loadingThread,
    openMessage,
    closeThread,
  };
}
