"use client";

type Props = {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
};

export default function FilterBar({ categories, active, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`
            px-4 py-1.5 rounded-full text-sm whitespace-nowrap
            border transition-all
            ${
              active === cat
                ? "bg-blue-600 text-white border-blue-600 shadow"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }
          `}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}