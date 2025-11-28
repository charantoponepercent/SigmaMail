"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = {
  activeFilter: string;
  setActiveFilter: (v: string) => void;
  activeCategory: string;
  setActiveCategory: (v: string) => void;
  sourceMessages: any[];
  setMessages: (msgs: any[]) => void;
};

export default function DropFilterBar({
  activeFilter,
  setActiveFilter,
  activeCategory,
  setActiveCategory,
  sourceMessages,
  setMessages,
}: Props) {
  return (
    <div className="flex sticky bg-white z-10">
      {/* Filter Dropdown */}
      <div className="px-3 py-3 w-1/3 sticky top-[56px] bg-white z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] flex items-center justify-between">
              <span className="truncate">{activeFilter}</span>
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06-.02L10 10.94l3.71-3.75a.75.75 0 111.08 1.04l-4.25 4.3a.75.75 0 01-1.08 0L5.25 8.23a.75.75 0 01-.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56 ml-24">
            <DropdownMenuRadioGroup value={activeFilter} onValueChange={setActiveFilter}>
              <DropdownMenuRadioItem value="TODAY">Today</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="YESTERDAY">Yesterday</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="WEEK">This Week</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="MONTHLY">This Month</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category Filter Dropdown */}
      <div className="px-3 py-3 w-1/3 sticky top-[56px] bg-white z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] flex items-center justify-between">
              <span className="truncate">{activeCategory || "All Categories"}</span>
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06-.02L10 10.94l3.71-3.75a.75.75 0 111.08 1.04l-4.25 4.3a.75.75 0 01-1.08 0L5.25 8.23a.75.75 0 01-.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56 ml-24">
            <DropdownMenuRadioGroup
              value={activeCategory}
              onValueChange={(cat) => {
                setActiveCategory(cat);
                setMessages(
                  cat === "All"
                    ? sourceMessages
                    : sourceMessages.map((msg) => ({
                        ...msg,
                        hidden: msg.category !== cat,
                      }))
                );
              }}
            >
              {["All","Work","Finance","Bills","Personal","Travel","Promotions","Updates","Social","Shopping","Priority","Spam"]
                .map((cat) => (
                  <DropdownMenuRadioItem key={cat} value={cat}>
                    {cat}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}