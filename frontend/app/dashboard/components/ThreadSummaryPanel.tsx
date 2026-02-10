"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { Bot, BrainCircuit, Clock3, Layers3, RefreshCw, Sparkles, X } from "lucide-react";

type SummaryMeta = {
  task?: string;
  strategy?: string;
  model?: string | null;
  confidence?: number | null;
  latencyMs?: number | null;
  cached?: boolean;
  error?: string | null;
};

type SummaryResponse = {
  summary?: string;
  _meta?: SummaryMeta;
};

type CachedItem = {
  summary: string;
  meta?: SummaryMeta;
  at: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  threadId?: string | null;
  threadSubject?: string;
  messageCount?: number;
  accountEmail?: string | null;
  onRunComplete?: () => void;
};

function shortAgo(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function ThreadSummaryPanel({
  open,
  onClose,
  threadId,
  threadSubject,
  messageCount = 0,
  accountEmail,
  onRunComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [meta, setMeta] = useState<SummaryMeta | null>(null);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const cacheRef = useRef<Record<string, CachedItem>>({});

  const confidence = useMemo(() => {
    if (typeof meta?.confidence !== "number") return "-";
    return `${Math.round(meta.confidence * 100)}%`;
  }, [meta?.confidence]);

  const runSummary = useCallback(
    async (force = false) => {
      if (!threadId) return;
      if (!force) {
        const cached = cacheRef.current[threadId];
        if (cached) {
          setSummary(cached.summary);
          setMeta(cached.meta || null);
          setError("");
          setLastUpdatedAt(cached.at);
          return;
        }
      }

      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/ai/summarize-thread`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ threadId }),
        });
        const data: SummaryResponse = await res.json();

        if (!res.ok) {
          throw new Error(data?.summary || data?._meta?.error || "Failed to summarize thread");
        }

        const resolvedSummary = (data?.summary || "").trim();
        if (!resolvedSummary) {
          throw new Error("No summary generated for this thread");
        }

        const now = Date.now();
        setSummary(resolvedSummary);
        setMeta(data?._meta || null);
        setLastUpdatedAt(now);
        cacheRef.current[threadId] = {
          summary: resolvedSummary,
          meta: data?._meta,
          at: now,
        };
        onRunComplete?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to summarize thread";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [onRunComplete, threadId]
  );

  useEffect(() => {
    if (!open) return;
    if (!threadId) {
      setSummary("");
      setMeta(null);
      setError("");
      setLastUpdatedAt(null);
      return;
    }
    runSummary(false);
  }, [open, runSummary, threadId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[235] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[0_30px_90px_rgba(15,23,42,0.2)]">
        <div className="relative border-b border-slate-100 px-6 py-5">
          <div className="absolute -top-16 right-[-48px] h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">AI Tools</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Thread Summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                Concise summary for the currently selected thread.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => runSummary(true)}
              disabled={!threadId || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {summary ? "Refresh Summary" : "Generate Summary"}
            </button>
            {lastUpdatedAt && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                Updated {shortAgo(lastUpdatedAt)}
              </span>
            )}
            {meta?.cached && (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                Cached
              </span>
            )}
          </div>
        </div>

        <div className="max-h-[66vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] text-slate-500">Thread</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-slate-900">
                {threadSubject || "No thread selected"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] text-slate-500">Messages</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-900 flex items-center gap-1">
                <Layers3 className="h-3.5 w-3.5 text-slate-500" />
                {messageCount || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] text-slate-500">Account</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-slate-900">
                {accountEmail || "-"}
              </p>
            </div>
          </div>

          {!threadId && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
              <Bot className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
              <p className="text-sm text-slate-700">Select any email thread first.</p>
              <p className="mt-1 text-xs text-slate-500">
                Then open AI Thread Summary from sidebar to generate summary.
              </p>
            </div>
          )}

          {!!threadId && error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {!!threadId && !error && loading && !summary && (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="mt-3 text-sm text-slate-700">Generating thread summary...</p>
            </div>
          )}

          {!!threadId && !!summary && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Strategy</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    {meta?.strategy || "unknown"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Confidence</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900">{confidence}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Model</p>
                  <p className="mt-1 truncate text-[13px] font-semibold text-slate-900 flex items-center gap-1">
                    <BrainCircuit className="h-3.5 w-3.5 text-cyan-600" />
                    {meta?.model || "local-route"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Latency</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                    {typeof meta?.latencyMs === "number" ? `${meta.latencyMs} ms` : "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Summary
                </p>
                <p className="whitespace-pre-wrap text-[14px] leading-7 text-slate-700">{summary}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

