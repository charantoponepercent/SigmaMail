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

      <main className="pt-36 px-6">
        {/* HERO */}
        <section className="max-w-6xl mx-auto text-center">
          <span className="inline-flex items-center rounded-full bg-black/5 px-4 py-1 text-sm font-medium text-gray-700">
            Built for serious email users
          </span>

          <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-gray-900">
            One Inbox.
            <span className="block bg-gradient-to-r from-black to-gray-500 bg-clip-text text-transparent">
              Every Gmail Account.
            </span>
          </h1>

          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            SigmaMail unifies all your Gmail accounts into a single intelligent
            inbox with fast search, clean organization, and AI-powered summaries.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <button className="px-6 py-3 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition">
              Get Started
            </button>
            <button className="px-6 py-3 rounded-lg border border-black/10 text-sm font-medium hover:bg-black/5 transition">
              View Demo
            </button>
          </div>
        </section>

        {/* METRICS */}
        <section className="mt-32 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "∞", label: "Gmail Accounts" },
            { value: "ms", label: "Search Latency" },
            { value: "AI", label: "Smart Summaries" },
            { value: "Prod", label: "Grade System" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-black/10 bg-white p-6"
            >
              <p className="text-3xl font-semibold text-gray-900">{m.value}</p>
              <p className="mt-1 text-sm text-gray-600">{m.label}</p>
            </div>
          ))}
        </section>

        {/* FEATURES */}
        <section className="mt-40 max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-gray-900 text-center">
            Designed for clarity at scale
          </h2>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Unified Inbox",
                desc: "Multiple Gmail accounts, one clean inbox. No context switching.",
              },
              {
                title: "Instant Search",
                desc: "Keyword + semantic search across all emails in milliseconds.",
              },
              {
                title: "AI Summaries",
                desc: "Turn long threads and newsletters into concise summaries.",
              },
              {
                title: "Noise Control",
                desc: "Automatically separate signal from promotions and newsletters.",
              },
              {
                title: "Scalable Backend",
                desc: "Built with background jobs, pagination, and de-duplication.",
              },
              {
                title: "Privacy First",
                desc: "OAuth-based access. Your data stays yours.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-black/10 bg-white p-6 hover:shadow-sm transition"
              >
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section
          id="about"
          className="scroll-mt-36 mt-40 max-w-4xl mx-auto text-center"
        >
          <h2 className="text-3xl font-semibold text-gray-900">
            Why SigmaMail?
          </h2>
          <p className="mt-6 text-gray-600 leading-relaxed">
            Existing email clients are built for volume. SigmaMail is built for
            focus — aggregating inboxes, surfacing what matters, and removing
            distraction.
          </p>
        </section>

        {/* CREATOR */}
        <section
          id="creator"
          className="scroll-mt-36 mt-40 max-w-4xl mx-auto"
        >
          <h2 className="text-2xl font-semibold text-gray-900">
            Creator & Vision
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            SigmaMail is built by a full-stack engineer who needed a real,
            scalable solution for managing personal, academic, and professional
            Gmail accounts.
          </p>
          <p className="mt-3 text-gray-600 leading-relaxed">
            This project focuses on production-grade architecture, thoughtful UX,
            and systems that scale — not shortcuts or demos.
          </p>
        </section>

        {/* CTA */}
        <section className="mt-40 max-w-5xl mx-auto rounded-2xl bg-black px-10 py-20 text-center text-white">
          <h2 className="text-3xl font-semibold">
            Take control of your inbox
          </h2>
          <p className="mt-4 text-white/70 max-w-xl mx-auto">
            Stop switching accounts. Stop missing important emails.
            Build clarity with SigmaMail.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <button className="px-6 py-3 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition">
              Start Now
            </button>
            <a
              href="https://github.com/your-github"
              target="_blank"
              className="px-6 py-3 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/10 transition"
            >
              GitHub
            </a>
          </div>
        </section>

        {/* CONTACT */}
        <section
          id="contact"
          className="scroll-mt-36 mt-40 text-center"
        >
          <p className="text-sm text-gray-500">
            Questions, feedback, or collaboration?
          </p>
          <a
            href="mailto:your-email@example.com"
            className="mt-2 inline-block text-sm font-medium text-black underline"
          >
            Contact the creator
          </a>
        </section>

        {/* FOOTER */}
        <footer className="mt-32 pb-12 text-center text-sm text-gray-500">
          SigmaMail · Built for clarity, scale, and real-world engineering
        </footer>
      </main>
    </>
  );
}