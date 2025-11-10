"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DOMPurify from "dompurify";

interface SecureEmailViewerProps {
  html: string;
  senderEmail: string;
  theme?: "light" | "dark";
}

export default function SecureEmailViewer({
  html,
  senderEmail,
  theme = "light",
}: SecureEmailViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [showImages, setShowImages] = useState(true);
  const [hasBlockedImages, setHasBlockedImages] = useState(false);

  // Attach Shadow DOM only once
  useEffect(() => {
    if (hostRef.current && !shadowRootRef.current) {
      shadowRootRef.current = hostRef.current.attachShadow({ mode: "open" });
    }
  }, []);

  // Render the sanitized HTML
  useEffect(() => {
    if (!shadowRootRef.current) return;
    const cleanHTML = DOMPurify.sanitize(html || "<p>(No content)</p>", {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
    });
    const processedHTML = showImages ? cleanHTML : cleanHTML.replace(/<img[^>]*>/gi, "");

    shadowRootRef.current.innerHTML = processedHTML;

    // Detect if there are hidden images
    if (/<img/i.test(html) && !showImages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasBlockedImages(true);
    } else {
      setHasBlockedImages(false);
    }
  }, [html, showImages]);

  // Handle image load errors & link clicks
  const handleClick = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A") {
      e.preventDefault();
      const href = target.getAttribute("href");
      if (!href) return;
      if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer");
      if (href.startsWith("mailto:")) window.location.href = href;
    }
  }, []);

  useEffect(() => {
    if (!shadowRootRef.current) return;
    const root = shadowRootRef.current;
    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, [handleClick]);

  return (
    <div className="flex flex-col">
      {hasBlockedImages && !showImages && (
        <div className="flex items-center justify-between bg-amber-100 border border-amber-300 text-amber-700 text-xs rounded px-3 py-2 mb-3">
          <p>Images are blocked for security.</p>
          <button
            onClick={() => setShowImages(true)}
            className="underline font-medium text-amber-700 hover:text-amber-900"
          >
            Show images
          </button>
        </div>
      )}

      <div
        ref={hostRef}
        className="w-full flex-1 overflow-y-auto text-sm text-gray-800 leading-relaxed"
        style={{
          backgroundColor: theme === "dark" ? "#121212" : "white",
          color: theme === "dark" ? "#e5e7eb" : "#111827",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      />
    </div>
  );
}
