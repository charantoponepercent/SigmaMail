"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Home", href: "/", type: "route" },
  { label: "Dashboard", href: "/dashboard", type: "route" },
  { label: "About", href: "#about", type: "hash" },
  { label: "Creator", href: "#creator", type: "hash" },
  { label: "Contact", href: "#contact", type: "hash" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    const onScroll = () => {
      const sections = ["about", "creator", "contact"];

      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.top <= 120 && rect.bottom >= 120) {
          setActiveHash(`#${id}`);
          break;
        }
      }
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-6 z-50 flex justify-center">
      <nav className="flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-md border border-black/5 shadow-sm px-2 py-1.5">
        <Link
          href="/"
          className="px-4 py-2 rounded-full text-sm font-semibold text-slate-900 hover:bg-black/5 transition"
        >
          SigmaMail
        </Link>
        {NAV_ITEMS.map(({ label, href, type }) => {
          const isActive =
            type === "route"
              ? pathname === href
              : pathname === "/" && activeHash === href;

          return (
            <Link
              key={label}
              href={href}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition
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
