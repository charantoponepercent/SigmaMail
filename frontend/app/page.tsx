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

      <main className="bg-[#fafafa] text-gray-900">
        {/* HERO */}
        <section className="relative pt-36 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent" />
          <div className="max-w-6xl mx-auto px-6 text-center relative">
            <span className="inline-block mb-6 text-xs font-medium tracking-wide text-gray-500 border px-3 py-1 rounded-full">
              Built for people who live in email
            </span>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
              Email, Reduced <br />
              <span className="text-gray-400">to What Matters</span>
            </h1>

            <p className="mt-8 text-lg text-gray-600 max-w-2xl mx-auto">
              SigmaMail unifies all your Gmail accounts into a single, decision-first inbox.
              No noise. No guessing. Just control.
            </p>

            <div className="mt-12 flex justify-center gap-4">
              <button className="px-8 py-3 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition">
                Open Inbox
              </button>
              <button className="px-8 py-3 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 transition">
                See How It Works
              </button>
            </div>
          </div>
        </section>

        {/* PRODUCT PREVIEW STRIP */}
        <section className="max-w-6xl mx-auto px-6">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            {[
              ["Unified Inbox", "All accounts. One view."],
              ["Decision Views", "Reply. Track. Follow-up."],
              ["Noise Isolation", "Bulk auto-filtered"],
              ["Real-Time Sync", "Instant updates"],
            ].map(([title, desc]) => (
              <div key={title}>
                <h4 className="font-medium">{title}</h4>
                <p className="text-gray-500 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CORE VALUE */}
        <section className="mt-40 max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-3xl font-semibold leading-tight">
                One Inbox.<br /> Every Gmail Account.
              </h2>
              <p className="mt-6 text-gray-600">
                Connect multiple Gmail accounts and treat them as one system.
                SigmaMail handles de-duplication, threading, and account awareness automatically.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <ul className="space-y-4 text-sm">
                {[
                  "OAuth-only Gmail access",
                  "Thread-aware aggregation",
                  "Account-aware filtering",
                  "No duplication across inboxes",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-black" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* DECISION ENGINE */}
        <section className="mt-40 bg-white border-y border-gray-200 py-32">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-semibold">
              Built Around Decisions — Not Folders
            </h2>
            <p className="mt-6 text-gray-600 max-w-2xl mx-auto">
              SigmaMail surfaces what needs action today instead of burying you in categories.
            </p>

            <div className="mt-16 grid md:grid-cols-3 gap-6">
              {[
                ["Needs Reply", "Incoming conversations waiting on you"],
                ["Deadlines Today", "Time-bound commitments extracted"],
                ["Follow-Ups", "Threads waiting on others"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-6 hover:bg-white transition"
                >
                  <h4 className="font-medium">{title}</h4>
                  <p className="mt-2 text-sm text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NOISE CONTROL */}
        <section className="mt-40 max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center">
            Noise Isolated by Design
          </h2>
          <p className="mt-6 text-gray-600 text-center max-w-2xl mx-auto">
            Bulk emails are separated using deterministic signals — fast, explainable,
            and stable. No black-box behavior.
          </p>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              "Newsletters",
              "Subscriptions",
              "Promotions",
              "Social & Bulk",
            ].map((t) => (
              <div
                key={t}
                className="rounded-lg border border-gray-200 bg-white py-4 text-center font-medium hover:bg-gray-50 transition"
              >
                {t}
              </div>
            ))}
          </div>
        </section>

        {/* ENGINEERING */}
        <section className="mt-40 max-w-6xl mx-auto px-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-2xl font-semibold">
              Engineered for Real-World Scale
            </h2>
            <p className="mt-6 text-gray-600 max-w-3xl mx-auto">
              Background workers, incremental sync, real-time updates,
              indexed queries, and fault-tolerant pipelines —
              designed for serious inbox volume.
            </p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mt-40 mb-32 max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-semibold">
            Take Back Control of Email
          </h2>
          <p className="mt-6 text-gray-600">
            Stop reacting. Start deciding.
          </p>

          <div className="mt-10">
            <button className="px-10 py-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition">
              Launch SigmaMail
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
