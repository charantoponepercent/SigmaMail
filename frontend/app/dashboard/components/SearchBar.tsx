"use client";

import { Search, Command } from "lucide-react";

type Props = {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export default function SearchBar({ onKeyDown }: Props) {
  return (
    <div className="relative group w-full">
      <Search
        className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-600"
      />

      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1
                     px-2 py-[3px] rounded-md bg-gray-100/70 border border-gray-200/70
                     text-gray-500 text-[10px] shadow-sm"
      >
        <Command className="w-3 h-3" />
        <span className="text-[14px]">K</span>
      </div>

      <input
        type="text"
        placeholder="Search mail, people, subjects…"
        className="
          w-full
          pl-12 pr-16
          py-2.5
          text-sm
          bg-white
          border border-gray-300
          rounded-2xl
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500/50
          transition-all
          placeholder:text-gray-500
        "
        onKeyDown={onKeyDown}
      />
    </div>
  );
}