"use client";

import { useCallback } from "react";

export function useThreadNavigation({
  messages,
  selectedMessage,
  selectedThreadId,
  selectedAccount,
  openMessage,
}) {
  // Get visible (non-hidden) threads
  const getVisibleThreads = useCallback(() => {
    return messages.filter((m) => !m.hidden);
  }, [messages]);

  // Determine current thread key
  const getCurrentThreadKey = useCallback(() => {
    if (selectedThreadId) return selectedThreadId;

    const fromSelected =
      selectedMessage?.threadId ||
      selectedMessage?.messages?.[0]?.threadId ||
      selectedMessage?.messages?.[0]?.id ||
      null;

    return fromSelected ?? null;
  }, [selectedThreadId, selectedMessage]);

  // Get index inside visible list
  const getSelectedIndex = useCallback(
    (visible) => {
      const key = getCurrentThreadKey();
      if (!key) return -1;
      return visible.findIndex((m) => (m.threadId || m.id) === key);
    },
    [getCurrentThreadKey]
  );

  // Scroll selected item into view
  const scrollThreadIntoView = useCallback((threadKey: string) => {
    const el = document.querySelector(
      `[data-thread-id="${threadKey}"]`
    ) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  // Move to previous thread
  const goPrevThread = useCallback(() => {
    const key = getCurrentThreadKey();
    if (!key) return;

    const visible = getVisibleThreads();
    const idx = getSelectedIndex(visible);
    if (idx <= 0) return;

    const target = visible[idx - 1];
    const scrollKey =
      target.threadId || target.id || target._id || target.messageId;

    const targetId =
      selectedAccount === "ALL"
        ? target._id ?? target.messageId ?? target.id
        : target.id ?? target.messageId ?? target._id;

    if (!targetId) return;

    openMessage(targetId);
    if (scrollKey) scrollThreadIntoView(scrollKey);
  }, [
    getCurrentThreadKey,
    getVisibleThreads,
    getSelectedIndex,
    selectedAccount,
    openMessage,
    scrollThreadIntoView,
  ]);

  // Move to next thread
  const goNextThread = useCallback(() => {
    const key = getCurrentThreadKey();
    if (!key) return;

    const visible = getVisibleThreads();
    const idx = getSelectedIndex(visible);
    if (idx < 0 || idx >= visible.length - 1) return;

    const target = visible[idx + 1];
    const scrollKey =
      target.threadId || target.id || target._id || target.messageId;

    const targetId =
      selectedAccount === "ALL"
        ? target._id ?? target.messageId ?? target.id
        : target.id ?? target.messageId ?? target._id;

    if (!targetId) return;

    openMessage(targetId);
    if (scrollKey) scrollThreadIntoView(scrollKey);
  }, [
    getCurrentThreadKey,
    getVisibleThreads,
    getSelectedIndex,
    selectedAccount,
    openMessage,
    scrollThreadIntoView,
  ]);

  return {
    goPrevThread,
    goNextThread,
  };
}