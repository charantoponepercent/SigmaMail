"use client";

import SearchBar from "./SearchBar";

type Props = {
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export default function HeaderBar({ onSearchKeyDown }: Props) {
  return (
    <div className="border-b border-gray-200 px-5 py-3 sticky top-0 bg-white/80 backdrop-blur-md z-10">
      <div className="flex items-center gap-3 w-full">
        <SearchBar onKeyDown={onSearchKeyDown} />
      </div>
    </div>
  );
}