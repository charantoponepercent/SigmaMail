"use client";

import { useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";

export function useThreadLoader({ setSelectedMessage, setSelectedThreadId }) {
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
  }, []);

  const closeThread = useCallback(() => {
    setSelectedMessage(null);
    setSelectedThreadId(null);
  }, []);

  return {
    loadingThread,
    openMessage,
    closeThread,
  };
}