"use client";

import {
  Clock3,
  Command,
  Hash,
  Layers3,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { SearchMeta, SearchMode, SearchPreviewItem } from "../../hooks/useSearch";

type Props = {
  open: boolean;
  onClose: () => void;
  query: string;
  mode: SearchMode;
  loading: boolean;
  meta: SearchMeta | null;
  results: SearchPreviewItem[];
  onQueryChange: (value: string) => void;
  onModeChange: (mode: SearchMode) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (id: string) => void;
  onClear: () => void;
};

const MODES: Array<{
  id: SearchMode;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "hybrid", label: "Hybrid", hint: "Balanced ranking", icon: Layers3 },
  { id: "semantic", label: "Semantic", hint: "Intent + meaning", icon: Sparkles },
  { id: "keyword", label: "Keyword", hint: "Exact terms only", icon: Hash },
];

function formatScore(score?: number) {
  if (typeof score !== "number") return "-";
  return `${Math.round(score * 100)}%`;
}

export default function SearchCommandPalette({
  open,
  onClose,
  query,
  mode,
  loading,
  meta,
  results,
  onQueryChange,
  onModeChange,
  onSearchKeyDown,
  onSelectResult,
  onClear,
}: Props) {
  if (!open) return null;

  const activeMode = MODES.find((m) => m.id === mode);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-12 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[0_34px_100px_rgba(15,23,42,0.36)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-100 px-5 py-4">
          <div className="absolute -right-14 -top-14 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl" />

          <div className="relative flex items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600">
              <Search className="h-4 w-4" />
            </div>
            <input
              autoFocus
              type="text"
              value={query}
              placeholder="Search by topic, intent, sender, or exact phrase..."
              className="flex-1 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 outline-none"
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {query && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onModeChange(m.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-indigo-200 bg-indigo-50/70 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${active ? "text-indigo-600" : "text-slate-500"}`} />
                    <p className={`text-[12px] font-semibold ${active ? "text-indigo-900" : "text-slate-800"}`}>
                      {m.label}
                    </p>
                  </div>
                  <p className={`mt-1 text-[11px] ${active ? "text-indigo-700" : "text-slate-500"}`}>
                    {m.hint}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-500">
              <Command className="h-3.5 w-3.5" />
              <span>Enter to search</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-500">
                Active: {activeMode?.label || mode}
              </span>
              {meta && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {meta.totalResults} results in {meta.latencyMs}ms
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[56vh] overflow-y-auto px-4 py-3">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500">
              Searching...
            </div>
          )}

          {!loading && query.trim().length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-8 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-indigo-500" />
              <p className="mt-2 text-sm text-slate-700">Type to search your inbox with intent + context.</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Example: &quot;threads waiting for my reply since yesterday&quot;
              </p>
            </div>
          )}

          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500">
              No semantic matches found for this query.
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2.5">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectResult(item.id);
                    onClose();
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-slate-900">{item.subject}</p>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {formatScore(item.score)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] text-slate-500">{item.from}</p>
                    {item.date && (
                      <p className="text-[11px] text-slate-400">{new Date(item.date).toLocaleDateString()}</p>
                    )}
                  </div>
                  {item.why.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.why.slice(0, 3).map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
