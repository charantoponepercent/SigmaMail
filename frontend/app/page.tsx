import Link from "next/link";
import {
  ArrowRight,
  Bolt,
  CheckCircle2,
  Clock3,
  Layers3,
  MailOpen,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
} from "lucide-react";
import { Manrope, Space_Grotesk } from "next/font/google";
import Navbar from "./components/Navbar";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const decisionModules = [
  {
    title: "Needs Reply",
    description: "Threads that require your response are surfaced first with clear urgency.",
    icon: MailOpen,
  },
  {
    title: "Deadline Radar",
    description: "Date and time commitments are extracted so nothing important slips.",
    icon: Clock3,
  },
  {
    title: "Follow-up Queue",
    description: "Pending conversations are tracked until closure, not forgotten.",
    icon: Workflow,
  },
];

const platformSignals = [
  "Multi-account Gmail aggregation",
  "Deterministic categorization + user feedback learning",
  "Action extraction for deadlines, follow-ups, reply intent",
  "Semantic search tuned for email workflows",
  "AI orchestration panel with model route visibility",
  "Privacy-first processing with secure OAuth flow",
];

const coreStats = [
  { value: "1 Inbox", label: "Across all connected accounts" },
  { value: "3 Priority Lanes", label: "Reply, deadline, follow-up" },
  { value: "Real-time", label: "Thread + category updates" },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className={`${bodyFont.className} relative overflow-x-hidden bg-[#f4f6fb] text-slate-900`}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-120px] h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.30),rgba(14,165,233,0))]" />
          <div className="absolute right-[-120px] top-[240px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.20),rgba(34,197,94,0))]" />
          <div className="absolute left-[-130px] top-[560px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18),rgba(99,102,241,0))]" />
        </div>

        <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-32 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              Inbox Intelligence Platform
            </span>

            <h1 className={`${displayFont.className} mt-6 text-4xl font-bold leading-[1.04] text-slate-900 sm:text-5xl lg:text-6xl`}>
              SigmaMail.
              <br />
              Stop managing email.
              <br />
              Start commanding it.
            </h1>

            <p className="mt-6 max-w-xl text-[17px] leading-7 text-slate-600">
              SigmaMail unifies multiple inboxes, extracts action signals, and gives you
              a decision-first workflow built for people who handle real volume.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-transparent px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white/80"
              >
                Open Demo Dashboard
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
              <Link href="/privacy" className="underline underline-offset-4 hover:text-slate-900">
                Privacy Policy
              </Link>
              <Link href="/terms" className="underline underline-offset-4 hover:text-slate-900">
                Terms of Service
              </Link>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {coreStats.map((item) => (
                <div key={item.value} className="rounded-xl border border-slate-200 bg-white/85 px-3 py-3 backdrop-blur-sm">
                  <p className={`${displayFont.className} text-lg font-bold text-slate-900`}>{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-2xl border border-white/40 bg-white/40 blur-sm" />
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 text-white">
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-sky-200">Live Workflow Preview</p>
                <p className={`${displayFont.className} mt-2 text-xl font-semibold`}>Today in SigmaMail</p>
              </div>
              <div className="space-y-3 bg-slate-50 p-5">
                {[
                  { label: "Needs Reply", count: "7 threads", tone: "bg-sky-100 text-sky-700" },
                  { label: "Deadlines", count: "3 due today", tone: "bg-amber-100 text-amber-700" },
                  { label: "Follow-ups", count: "5 pending", tone: "bg-emerald-100 text-emerald-700" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.tone}`}>
                        {item.count}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Prioritized from all connected accounts with latest-first thread context.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="relative mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] sm:p-9">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Why Teams Switch</p>
                <h2 className={`${displayFont.className} mt-3 text-3xl font-semibold leading-tight text-slate-900`}>
                  Built for action, not archive browsing.
                </h2>
                <p className="mt-4 text-slate-600">
                  SigmaMail is designed around operational clarity: what needs response,
                  what has a deadline, and what must be followed up.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {platformSignals.map((signal) => (
                  <div
                    key={signal}
                    className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-700"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p>{signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 pb-24">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Decision Engine</p>
            <h2 className={`${displayFont.className} mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl`}>
              The three lanes that drive your inbox day
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {decisionModules.map((module) => {
              const Icon = module.icon;
              return (
                <article
                  key={module.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className={`${displayFont.className} mt-4 text-xl font-semibold text-slate-900`}>{module.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{module.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="creator" className="relative mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-[0_24px_50px_rgba(15,23,42,0.25)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Creator Note</p>
              <h2 className={`${displayFont.className} mt-3 text-2xl font-semibold sm:text-3xl`}>
                SigmaMail is built to solve real inbox fatigue, not demo-only AI.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                You already have the right direction: action detection, feedback-based classification,
                and semantic retrieval in one flow. This page now communicates that clearly from first glance.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Privacy-first architecture
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                <Layers3 className="h-4 w-4 text-sky-400" />
                Multi-account operational view
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                <Bolt className="h-4 w-4 text-amber-400" />
                Fast decision-first triage
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="relative mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_14px_36px_rgba(15,23,42,0.08)] sm:p-10">
            <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Get Started</p>
                <h2 className={`${displayFont.className} mt-3 text-3xl font-semibold text-slate-900`}>
                  Ready to run your inbox like a system?
                </h2>
                <p className="mt-4 max-w-2xl text-slate-600">
                  Create an account and connect your first inbox. SigmaMail immediately starts
                  organizing threads into action-ready workflows.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  <UserRound className="h-4 w-4" />
                  Create Account
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>
        <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-slate-200 px-6 pb-8 pt-6 text-sm text-slate-500">
          <p>SigmaMail helps users triage Gmail and respond faster with action-first inbox intelligence.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-900 underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 underline underline-offset-4">Terms</Link>
          </div>
        </footer>
      </main>
    </>
  );
}
