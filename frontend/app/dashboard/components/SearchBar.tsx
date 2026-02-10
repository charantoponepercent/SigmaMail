"use client";

import { Command, Search, X } from "lucide-react";
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

const MODES: Array<{ id: SearchMode; label: string }> = [
  { id: "hybrid", label: "Hybrid" },
  { id: "semantic", label: "Semantic" },
  { id: "keyword", label: "Keyword" },
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
    <div className="w-full">
      <div className="relative group w-full">
        <Search className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-600" />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-[3px] rounded-md bg-gray-100/70 border border-gray-200/70 text-gray-500 text-[10px] shadow-sm">
          <Command className="w-3 h-3" />
          <span className="text-[14px]">K</span>
        </div>

        <input
          type="text"
          value={value}
          placeholder="Search mail, people, topics, attachments..."
          className="w-full pl-12 pr-16 py-2.5 text-sm bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-500"
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleModeChange(m.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                mode === m.id
                  ? "bg-white border border-gray-200 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          {meta && (
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              {meta.totalResults} results in {meta.latencyMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
