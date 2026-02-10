"use client";

import SearchBar from "./SearchBar";
import { SearchMeta, SearchMode } from "../hooks/useSearch";

type Props = {
  searchQuery: string;
  searchMode: SearchMode;
  searchMeta: SearchMeta | null;
  onSearchChange: (value: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchClear: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export default function HeaderBar({
  searchQuery,
  searchMode,
  searchMeta,
  onSearchChange,
  onSearchModeChange,
  onSearchClear,
  onSearchKeyDown,
}: Props) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70 px-5 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3 w-full">
        <SearchBar
          value={searchQuery}
          mode={searchMode}
          meta={searchMeta}
          onChange={onSearchChange}
          onModeChange={onSearchModeChange}
          onClear={onSearchClear}
          onKeyDown={onSearchKeyDown}
        />
      </div>
    </div>
  );
}
