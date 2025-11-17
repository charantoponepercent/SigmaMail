/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { API_BASE } from "@/lib/api";

interface SecureEmailViewerProps {
  html: string;
  senderEmail: string;
  messageId: string; // required for lazy attachment fetching
  accountEmail: string; // required for attachment API
  theme?: "light" | "dark";
}

export default function SecureEmailViewer({
  html,
  senderEmail,
  messageId,
  accountEmail,
  theme = "light",
}: SecureEmailViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [showImages, setShowImages] = useState(true);
  const [hasBlockedImages, setHasBlockedImages] = useState(false);

  // attach shadow root once
  useEffect(() => {
    if (hostRef.current && !shadowRootRef.current) {
      shadowRootRef.current = hostRef.current.attachShadow({ mode: "open" });
    }
  }, []);

  // Helper: fetch base64 from backend
  const fetchAttachmentBase64 = useCallback(
    async (cid: string) => {
      try {
        // We call the attachment endpoint with cid as attId.
        // Backend should resolve cid -> attachmentId if necessary.
        const url = `${API_BASE}/api/gmail/attachment/${encodeURIComponent(
          messageId
        )}/${encodeURIComponent(cid)}?account=${encodeURIComponent(accountEmail)}`;

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          console.warn("Attachment fetch failed", url, res.status);
          return null;
        }

        const data = await res.json();
        // Expected { base64: "..." } — or adapt if backend returns differently
        return data.base64 ?? null;
      } catch (err) {
        console.error("fetchAttachmentBase64 error:", err);
        return null;
      }
    },
    [messageId, accountEmail]
  );

  // Render sanitized HTML and setup lazy loading for cid: images
  useEffect(() => {
    const root = shadowRootRef.current;
    if (!root) return;

    // sanitize HTML, allow img & common attributes
    const cleanHTML = DOMPurify.sanitize(html || "<p>(No content)</p>", {
      ADD_TAGS: ["iframe", "img"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "src", "data-cid"],
    });

    const processedHTML = showImages ? cleanHTML : cleanHTML.replace(/<img[^>]*>/gi, "");

    // Render into shadow DOM
    root.innerHTML = `
      <style>
        :host { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        img.lazy-loading { opacity: 0.45; transition: opacity 240ms ease-in-out; }
        img.loaded { opacity: 1; }
        /* basic reset for quoted sections that may be embedded; leave styling minimal */
        blockquote { border-left: 3px solid #e5e7eb; margin-left: 0.5rem; padding-left: 0.75rem; color: #374151; }
      </style>
      <div id="email-root">${processedHTML}</div>
    `;

    // Determine whether there are images blocked
    if (/<img/i.test(html) && !showImages) setHasBlockedImages(true);
    else setHasBlockedImages(false);

    if (!showImages) return;

    const emailRoot = root.querySelector("#email-root") as HTMLElement | null;
    if (!emailRoot) return;

    // Replace CID images with placeholder & data-cid attribute if any
    // Note: some images might already be data urls or http(s) urls => leave them
    const imgs = Array.from(emailRoot.querySelectorAll("img"));
    imgs.forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (src.startsWith("cid:")) {
        const cid = src.replace(/^cid:/i, "").replace(/[<>]/g, "");
        // remove src so browser doesn't try to load invalid url
        img.removeAttribute("src");
        img.setAttribute("data-cid", cid);
        img.classList.add("lazy-loading");
        // set an accessible alt if none
        if (!img.getAttribute("alt")) img.setAttribute("alt", "inline image");
        // optionally set a lightweight placeholder tiny transparent image so layout holds
        img.setAttribute(
          "src",
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" // 1x1 transparent gif
        );
      } else {
        // non-cid images: let them load normally but mark for CSS transition when loaded
        img.addEventListener("load", () => {
          img.classList.add("loaded");
        });
      }
    });

    // IntersectionObserver for lazy loading CID images when visible
    // IntersectionObserver for lazy loading CID images when visible
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const el = entry.target as HTMLImageElement;
      const cid = el.getAttribute("data-cid");
      if (!cid) {
        observer.unobserve(el);
        continue;
      }

      (async () => {
        try {
          const base64 = await fetchAttachmentBase64(cid);
          if (base64) {
            el.src = `data:image/png;base64,${base64}`;
            el.classList.add("loaded");
          } else {
            el.src =
              "data:image/svg+xml;base64," +
              btoa(
                `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='30'><text x='0' y='14' font-size='10' fill='#999'>image</text></svg>`
              );
            el.classList.add("loaded");
          }
        } catch (err) {
          console.error("CID load error:", err);
        } finally {
          observer.unobserve(el);
        }
      })();
    }
  },
  {
    // ❗ FIX: No root here. ShadowRoot is invalid.
    rootMargin: "200px",
    threshold: 0.01,
  }
);

    // observe all cid images
    emailRoot.querySelectorAll("img[data-cid]").forEach((img) => observer.observe(img));

    // Link handling: open external links in new tab from shadow root
    const linkHandler = (ev: Event) => {
      const t = ev.target as HTMLElement;
      if (t && t.tagName === "A") {
        ev.preventDefault();
        const href = (t as HTMLAnchorElement).getAttribute("href");
        if (!href) return;
        if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer");
        if (href.startsWith("mailto:")) (window.location.href = href);
      }
    };
    emailRoot.addEventListener("click", linkHandler);

    // cleanup
    return () => {
      observer.disconnect();
      emailRoot.removeEventListener("click", linkHandler);
    };
  }, [html, showImages, fetchAttachmentBase64, messageId, accountEmail]);

  // basic click handler for links at shadow root level (safety)
  const handleClick = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A") {
      e.preventDefault();
      const href = (target as HTMLAnchorElement).getAttribute("href");
      if (!href) return;
      if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer");
      if (href.startsWith("mailto:")) (window.location.href = href);
    }
  }, []);

  useEffect(() => {
    const root = shadowRootRef.current;
    if (!root) return;
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