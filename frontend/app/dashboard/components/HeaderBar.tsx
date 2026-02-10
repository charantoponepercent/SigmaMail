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
    <div className="border-b border-gray-200 px-5 py-3 sticky top-0 bg-white/80 backdrop-blur-md z-10">
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
