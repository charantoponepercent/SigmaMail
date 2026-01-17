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

      <main className="pt-32 px-6 space-y-32">
        {/* HERO */}
        <section className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
            SigmaMail
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            A unified inbox that brings all your Gmail accounts into one
            intelligent, distraction-free experience.
          </p>
        </section>

        {/* ABOUT / PROBLEM */}
        <section id="about" className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900">
            What problem does SigmaMail solve?
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Managing multiple Gmail accounts forces users to constantly switch
            tabs, lose context, and miss important emails. Searching across
            accounts is fragmented, and newsletters clutter the inbox.
          </p>
          <p className="mt-3 text-gray-600 leading-relaxed">
            SigmaMail solves this by aggregating multiple Gmail accounts into a
            single inbox, enabling fast search, clean organization, and AI-based
            summaries — all in one place.
          </p>
        </section>

        {/* CREATOR / MOTIVATION */}
        <section id="creator" className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900">
            Creator & Motivation
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            SigmaMail is built by a full-stack engineer who experienced the pain
            of managing personal, academic, and professional emails across
            multiple Gmail accounts.
          </p>
          <p className="mt-3 text-gray-600 leading-relaxed">
            The goal was simple: build a production-grade system that focuses on
            signal over noise, scales reliably, and demonstrates real-world
            backend and frontend engineering.
          </p>
        </section>

        {/* CONTACT */}
        <section
          id="contact"
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-2xl font-semibold text-gray-900">
            Contact the Creator
          </h2>
          <p className="mt-4 text-gray-600">
            Interested in SigmaMail, collaboration, or feedback?
          </p>

          <div className="mt-6 flex justify-center gap-4">
            <a
              href="mailto:your-email@example.com"
              className="px-6 py-3 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition"
            >
              Email
            </a>
            <a
              href="https://github.com/your-github"
              target="_blank"
              className="px-6 py-3 rounded-lg border border-black/10 text-sm font-medium hover:bg-black/5 transition"
            >
              GitHub
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center text-sm text-gray-500 pb-12">
          SigmaMail · Built with focus, scalability, and clarity
        </footer>
      </main>
    </>
  );
}