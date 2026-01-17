"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");
  }, [router]);

  return (
    <>
      <Navbar />

      <main className="pt-32 px-6">
        {/* Hero */}
        <section className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
            One Inbox. All Your Email.
          </h1>

          <p className="mt-4 text-gray-600 text-lg max-w-2xl mx-auto">
            SigmaMail brings all your Gmail accounts into a single,
            distraction-free inbox with intelligent search and summaries.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <button className="px-6 py-3 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition">
              Connect Gmail
            </button>
            <button className="px-6 py-3 rounded-lg border border-black/10 text-sm font-medium hover:bg-black/5 transition">
              View Demo Inbox
            </button>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-6xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-black/5 p-6 bg-white"
            >
              <h3 className="text-lg font-medium text-gray-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {f.description}
              </p>
            </div>
          ))}
        </section>

        {/* Footer hint */}
        <section className="text-center mt-24 text-sm text-gray-500">
          Built for focus. Designed for scale.
        </section>
      </main>
    </>
  );
}

const FEATURES = [
  {
    title: "Unified Inbox",
    description:
      "Manage multiple Gmail accounts in one place without switching contexts.",
  },
  {
    title: "Smart Search",
    description:
      "Keyword + semantic search powered by embeddings for instant discovery.",
  },
  {
    title: "AI Summaries",
    description:
      "Get concise email summaries and daily digests powered by LLMs.",
  },
];