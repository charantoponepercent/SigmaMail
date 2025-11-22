/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { API_BASE } from "@/lib/api";

interface SecureEmailViewerProps {
  html: string;
  senderEmail: string;
  messageId: string;
  accountEmail: string;
  theme?: "light" | "dark";
  attachments?: { filename: string; mimeType: string; storageUrl?: string }[];
}

export default function SecureEmailViewer({
  html,
  senderEmail,
  messageId,
  accountEmail,
  theme = "light",
  attachments = [],
}: SecureEmailViewerProps) {
  void senderEmail;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [showImages, setShowImages] = useState(true);
  const [hasBlockedImages, setHasBlockedImages] = useState(false);
  const [cidImages, setCidImages] = useState<string[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (hostRef.current && !shadowRootRef.current) {
      shadowRootRef.current = hostRef.current.attachShadow({ mode: "open" });
    }
  }, []);

  const fetchAttachmentBase64 = useCallback(
    async (cid: string) => {
      try {
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
        return data.base64 ?? null;
      } catch (err) {
        console.error("fetchAttachmentBase64 error:", err);
        return null;
      }
    },
    [messageId, accountEmail]
  );

  useEffect(() => {
    const root = shadowRootRef.current;
    if (!root) return;

    // Cleanup previous observer if it exists
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const foundCids = Array.from(new Set(
      [...(html.match(/cid:([^"' >]+)/gi) || [])].map(x => x.replace(/^cid:/, "").replace(/[<>]/g, ""))
    ));
    setCidImages(foundCids);

    const cleanHTML = DOMPurify.sanitize(html || "<p>(No content)</p>", {
      ADD_TAGS: ["iframe", "img", "style"],
      ADD_ATTR: [
        "allow", "allowfullscreen", "frameborder", "scrolling", "src", "data-cid",
        "width", "height", "align", "valign", "bgcolor", "cellpadding", 
        "cellspacing", "border", "style", "class", "id"
      ],
      ALLOW_UNKNOWN_PROTOCOLS: true,
    });

    const processedHTML = showImages ? cleanHTML : cleanHTML.replace(/<img[^>]*>/gi, "");

    // CLEAR and set innerHTML (not append) to prevent duplicates
    root.innerHTML = `
      <style>
        :host {
          all: initial;
          display: block;
        }
        
        img.lazy-loading {
          opacity: 0.5;
          transition: opacity 0.3s;
        }
        img.loaded {
          opacity: 1;
        }
      </style>
      ${processedHTML}
    `;

    if (/<img/i.test(html) && !showImages) setHasBlockedImages(true);
    else setHasBlockedImages(false);

    if (!showImages) return;

    const imgs = Array.from(root.querySelectorAll("img"));
    imgs.forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (src.startsWith("cid:")) {
        const cid = src.replace(/^cid:/i, "").replace(/[<>]/g, "");
        img.removeAttribute("src");
        img.setAttribute("data-cid", cid);
        img.classList.add("lazy-loading");
        if (!img.getAttribute("alt")) img.setAttribute("alt", "inline image");
        img.setAttribute(
          "src",
          "image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        );
      } else {
        img.addEventListener("load", () => {
          img.classList.add("loaded");
        });
      }
    });

    // Create NEW observer each time
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
                el.src = `image/png;base64,${base64}`;
                el.classList.add("loaded");
              } else {
                el.src =
                  "image/svg+xml;base64," +
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
        rootMargin: "200px",
        threshold: 0.01,
      }
    );

    // Store in ref
    observerRef.current = observer;

    root.querySelectorAll("img[data-cid]").forEach((img) => observer.observe(img));

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
    root.addEventListener("click", linkHandler);

    return () => {
      // Cleanup on unmount or re-render
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      root.removeEventListener("click", linkHandler);
    };
  }, [html, showImages, fetchAttachmentBase64]);

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
    <div className="flex flex-col w-full">
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
        className="w-full"
        style={{
          minHeight: "200px",
        }}
      />
      
      {cidImages.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {cidImages.map((cid) => (
            <ThumbnailLoader
              key={cid}
              cid={cid}
              fetchBase64={fetchAttachmentBase64}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThumbnailLoader({ cid, fetchBase64 }: { cid: string; fetchBase64: (c: string) => Promise<string | null>; }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const b64 = await fetchBase64(cid);
      if (!mounted) return;
      if (b64) setSrc(`image/png;base64,${b64}`);
    })();
    return () => {
      mounted = false;
    };
  }, [cid, fetchBase64]);

  if (!src) return <div className="w-16 h-16 bg-gray-200 rounded-md animate-pulse" />;

  return (
    <img
      src={src}
      alt="attachment thumbnail"
      className="w-16 h-16 object-cover rounded-md border"
    />
  );
}
