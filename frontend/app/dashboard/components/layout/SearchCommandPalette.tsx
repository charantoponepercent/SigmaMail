"use client";

import { Clock3, Search, Sparkles, X } from "lucide-react";
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

const MODES: Array<{ id: SearchMode; label: string }> = [
  { id: "hybrid", label: "Hybrid" },
  { id: "semantic", label: "Semantic" },
  { id: "keyword", label: "Keyword" },
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

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="mt-16 w-full max-w-2xl rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
              <Search className="h-4 w-4" />
            </div>
            <input
              autoFocus
              type="text"
              value={query}
              placeholder="Semantic search across your inbox..."
              className="flex-1 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 outline-none"
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {query && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  mode === m.id
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-transparent bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                {m.label}
              </button>
            ))}

            {meta && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                {meta.totalResults} results in {meta.latencyMs}ms
              </span>
            )}
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-3 py-3">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
              Searching...
            </div>
          )}

          {!loading && query.trim().length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-indigo-500" />
              <p className="mt-2 text-sm text-slate-600">Type a query to search by intent and meaning.</p>
            </div>
          )}

          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
              No semantic matches found for this query.
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectResult(item.id);
                    onClose();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-slate-900">{item.subject}</p>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {formatScore(item.score)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">{item.from}</p>
                  {item.why.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-slate-400">{item.why.join(" · ")}</p>
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
