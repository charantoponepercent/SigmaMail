"use client";

import { Command, Hash, Layers3, Search, Sparkles, X } from "lucide-react";
import { SearchMeta, SearchMode } from "../hooks/useSearch";

type Props = {
  value: string;
  mode: SearchMode;
  meta: SearchMeta | null;
  onChange?: (value: string) => void;
  onModeChange?: (mode: SearchMode) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
};

const MODES: Array<{
  id: SearchMode;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "hybrid", label: "Hybrid", hint: "Best overall", icon: Layers3 },
  { id: "semantic", label: "Semantic", hint: "Intent aware", icon: Sparkles },
  { id: "keyword", label: "Keyword", hint: "Exact terms", icon: Hash },
];

export default function SearchBar({
  value,
  mode,
  meta,
  onChange,
  onModeChange,
  onKeyDown,
  onClear,
}: Props) {
  const handleChange = onChange || (() => {});
  const handleModeChange = onModeChange || (() => {});
  const handleKeyDown = onKeyDown || (() => {});
  const handleClear = onClear || (() => {});

  return (
    <div className="w-full space-y-2.5">
      <div className="group relative w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-600" />

        <input
          type="text"
          value={value}
          placeholder="Search people, threads, actions, or topics..."
          className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3 pl-11 pr-[132px] text-[14px] text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">
            <Command className="h-3.5 w-3.5" />
            <span>K</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeChange(m.id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
                title={m.hint}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-500">
            Mode: {meta?.modeUsed || mode}
          </span>
          {meta && (
            <>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600">
                {meta.totalResults} results
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-500">
                {meta.latencyMs}ms
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
