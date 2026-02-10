/* eslint-disable prefer-const */
"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { API_BASE } from "@/lib/api";

type Msg = { sender: "user" | "ai" | "system"; text: string };

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 pl-2 py-1">
      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse animation-delay-100" />
      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse animation-delay-200" />
    </div>
  );
}

function MessageBubble({ sender, text }: { sender: Msg["sender"]; text: string }) {
  const isHeading = text.startsWith("Summary of:");

  if (isHeading) {
    return (
      <div className="w-fit max-w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-[15px] font-semibold text-gray-700 shadow-none mt-3">
        {text}
      </div>
    );
  }

  return (
    <div
      className={`max-w-full w-fit px-3 py-2 rounded-xl text-[14px] leading-relaxed mt-1 ${
        sender === "user"
          ? "text-black border bg-gray-100 border-gray-200 self-end"
          : "bg-white border border-gray-100 text-gray-900"
      }`}
      style={{ marginLeft: sender === "user" ? "auto" : undefined }}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}

export default function MinimalChat({
  currentThreadId,
  currentSubject,
}: {
  currentThreadId?: string;
  currentSubject?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function handleQuickPrompt(text: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!text?.trim()) return;
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");
    // NEW — Call classifier to detect summarization intent
    const classifyRes = await fetch(`${API_BASE}/api/ai/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message: text }),
    });

    if (!classifyRes.ok) {
      setMessages((prev) => [...prev, { sender: "ai", text: "SigmaAI could not classify your request right now." }]);
      return;
    }

    const classify = await classifyRes.json();
    const wantsSummary = classify?.summarize === true;

    if (wantsSummary) {
      if (!currentThreadId) {
        setMessages((prev) => [...prev, { sender: "system", text: "❗ No email selected to summarize." }]);
        return;
      }

      setIsThinking(true);
      setMessages((prev) => [...prev, { sender: "system", text: "SigmaAI is analyzing the email…" }]);

      try {
        const res = await fetch(`${API_BASE}/api/ai/summarize-thread`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ threadId: currentThreadId }),
        });

        if (!res.ok) {
          throw new Error("summary_request_failed");
        }

        const data = await res.json();

        // Remove thinking bubble
        setMessages((prev) => prev.filter((m) => m.sender !== "system"));

        if (data.summary) {
          let html = data.summary
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br/>");

          setMessages((prev) => [
            ...prev,
            { sender: "ai", text: `Summary of: ${currentSubject || "This Email"}` },
          ]);

          setMessages((prev) => [
            ...prev,
            { sender: "ai", text: html },
          ]);

          if (data?._meta?.strategy) {
            setMessages((prev) => [
              ...prev,
              {
                sender: "system",
                text: `AI route: ${data._meta.strategy}${data?._meta?.cached ? " (cached)" : ""}`,
              },
            ]);
          }
        } else {
          setMessages((prev) => [...prev, { sender: "ai", text: "No summary available." }]);
        }

        setIsThinking(false);
        return;

      } catch (err) {
        setMessages((prev) => [...prev, { sender: "ai", text: "SigmaAI encountered an error while summarizing." }]);
        setIsThinking(false);
        return;
      }
    }
    // NORMAL CHAT RESPONSE
    setIsThinking(true);
    setMessages((prev) => [...prev, { sender: "system", text: "" }]);
    await sleep(600);
    setMessages((prev) => prev.filter((m) => m.sender !== "system"));
    setMessages((prev) => [...prev, { sender: "ai", text: `I received: ${text}` }]);
    setIsThinking(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickPrompt(input);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-4 w-14 h-14 transition-all z-[999]"
        >
          <div
          className="
            w-12 h-12
            rounded-lg
            bg-white
            shadow-[0_0_12px_rgba(0,0,0,0.15)]
            flex items-center justify-center
            cursor-pointer
            transition
            hover:scale-105
            hover:shadow-[0_0_18px_rgba(147,51,234,0.6)] transition-shadow duration-200
            border border-gray-300
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500/50
            transition-all
            placeholder:text-gray-500
          "
        >
          <svg 
            viewBox="0 0 512 512" 
            xmlns="http://www.w3.org/2000/svg" 
            fillRule="evenodd" 
            clipRule="evenodd" 
            strokeLinejoin="round" 
            strokeMiterlimit="2"
            className="w-5.5 h-5.5"
          >
            <path 
              d="M344.166 293.749c62.12 4.84 123.736-22.287 131.097-90.76a6.061 6.061 0 00-3.126-6.05 5.873 5.873 0 00-2.551-.585c-2.47 0-4.7 1.573-5.516 3.912-31.766 69.684-113.55 45.078-146.426 38.019a632.035 632.035 0 00-133.82-17.245c-62.12 1.513-102.76 18.555-139.77 64.641-37.01 46.086-42.858 142.19 26.119 194.427 60.94 45.189 146.274 40.328 201.688-11.496 42.91-44.533 62.947-106.47 54.254-167.703-25.614-3.732-50.422-8.774-74.927-13.312-88.642-16.84-141.887 0-167.2 52.237a88.021 88.021 0 000 78.86c13.947 26.593 39.794 44.977 69.482 49.414 35.9 7.634 73.384-1.674 101.55-25.211 32.674-28.035 49.716-74.725 48.204-131.097l9.58 1.613c1.412 58.59-17.144 107.097-51.532 136.846-30.344 25.513-70.842 35.618-109.617 27.328-32.3-4.991-60.406-24.979-75.734-53.85a97.782 97.782 0 010-87.432c12.485-27.248 36.133-47.84 64.843-56.473 29.245-9.277 66.154-10.084 112.844-.907 33.279 6.05 73.213 13.714 90.558 14.824zm-140.072 83.6c-18.051 34.387-64.137 40.337-85.92 16.941-21.782-23.396-9.58-56.674 10.085-73.414a107.351 107.351 0 0188.743-20.774c-.908 32.875-3.328 59.094-12.908 77.246zm5.345-164.578a676.168 676.168 0 01109.617 16.438c-15.227-65.146 0-119.601 47.9-137.653a79.333 79.333 0 0129.931-5.869c39.29 0 72.94 29.205 78.477 68.09.908 4.942 3.328 6.454 6.555 6.858 3.58.464 6.978-1.846 7.866-5.345 12.333-45.582-2.925-94.4-39.027-124.845C419.053 5.204 377.636-4.497 338.015 4.024 243.12 23.789 204.497 112.633 209.439 212.77zm276.01-66.557c8.47-38.12-33.884-135.131-127.265-125.248a134.386 134.386 0 00-95.5 54.859c-21.984 31.867-30.253 74.02-30.253 125.752l-9.48-.806c0-32.976 1.715-86.323 30.254-127.87a142.272 142.272 0 0198.625-60.507c108.105-14.32 146.728 95.5 133.619 133.82z" 
              fill="#2f2f31" 
              fillRule="nonzero"
            />
          </svg>
        </div>
        </button>
      )}

      {open && (
        <div className="fixed bottom-3 right-3 w-[430px] h-[76vh] bg-white border border-gray-100 shadow-2xl rounded-3xl z-[999] flex flex-col overflow-hidden">
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <button onClick={() => setOpen(false)} className="cursor-pointer text-gray-400 hover:text-gray-700 text-md">✕</button>
            <span className="font-semibold text-[15px] text-gray-800">SigmaAI</span>
          </div>
          {/* CENTER / MESSAGES */}
          <div className="flex-1 px-4 py-3 overflow-y-auto space-y-2 bg-white/50">
            <div className="flex flex-col gap-2 pr-3">

              {/* INITIAL EMPTY UI */}
              {messages.length === 0 && !isThinking && (
                <div className="w-full flex flex-col items-center text-center mt-6 mb-4 px-4">
                  <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center shadow-sm mb-3">
                    <span className="text-purple-600 text-2xl font-bold">Σ</span>
                  </div>

                  <h2 className="text-[15px] font-semibold text-gray-700">
                    Ask anything about your emails
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Summaries • Insights • Actions • Clarifications
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-2 w-full">
                    {[
                      "Summarize this email",
                      "What is this email about?",
                      "Explain this in simple words",
                      "Is this email important?",
                      "Extract key points",
                      "Rewrite this professionally",
                    ].map((t, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickPrompt(t)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 shadow-sm transition"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* NORMAL MESSAGE STREAM */}
              {messages.length > 0 &&
                messages.map((m, i) => (
                  <MessageBubble key={i} sender={m.sender} text={m.text} />
                ))}

              {isThinking && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>
          </div>
          {/* INPUT BAR */}
          <div className="p-4 flex items-center gap-3 bg-white/95">
            <div className="relative w-full">
                <input
                className="flex-1 w-full p-4 pr-20 bg-white rounded-xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-purple-200 transition"
                placeholder="Type your message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                <button
                    onClick={() => handleQuickPrompt(input)}
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    aria-label="send"
                    type="button"
                >
                    <Send size={18} />
                </button>
                </div>
            </div>
            </div>
        </div>
      )}
    </>
  );
}
