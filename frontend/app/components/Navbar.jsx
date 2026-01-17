"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "About", href: "#about" },
  { label: "Creator", href: "#creator" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-6 z-50 flex justify-center">
      <nav
        className="
          flex items-center gap-1
          rounded-full
          bg-white/80 backdrop-blur-md
          border border-black/5
          shadow-sm
          px-2 py-1.5
        "
      >
        {NAV_ITEMS.map(({ label, href }) => {
          const isActive = href === pathname;

          return (
            <Link
              key={label}
              href={href}
              className={`
                px-4 py-2 rounded-full
                text-sm font-medium
                transition-colors
                ${
                  isActive
                    ? "bg-black text-white"
                    : "text-gray-600 hover:text-black hover:bg-black/5"
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}