"use client";

import {
  CalendarDays,
  Clock3,
  FileText,
  Mail,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

type DigestAction = {
  text: string;
  emailId?: string;
  due?: string;
};

type DigestSender = {
  sender: string;
  count: number;
};

type DigestMeta = {
  task?: string;
  strategy?: string;
  model?: string | null;
  confidence?: number | null;
  cached?: boolean;
};

type DigestData = {
  summary?: string;
  important?: string[];
  meetings?: Array<{ subject?: string; date?: string }>;
  dates?: string[];
  topSenders?: DigestSender[];
  highlights?: string[];
  actions?: DigestAction[];
  sections?: {
    bills?: Array<{ subject?: string; from?: string; possibleDates?: string[]; amounts?: string[] }>;
    meetings?: Array<{ subject?: string; from?: string; possibleDates?: string[] }>;
    travel?: Array<{ subject?: string; from?: string }>;
    attachments?: Array<{ subject?: string; from?: string }>;
    priorityUnread?: Array<{ subject?: string; from?: string }>;
  };
  _meta?: DigestMeta;
};

type Props = {
  open: boolean;
  onClose: () => void;
  digestText: string | DigestData;
  loading: boolean;
};

export default function DigestModal({ open, onClose, digestText, loading }: Props) {
  if (!open) return null;

  const digest: DigestData =
    typeof digestText === "string"
      ? { summary: digestText }
      : digestText || {};
  const meetings = Array.isArray(digest.meetings)
    ? digest.meetings
    : Array.isArray(digest.sections?.meetings)
      ? digest.sections.meetings.map((m) => ({
          subject: m.subject,
          date: m.possibleDates?.[0],
        }))
      : [];
  const bills = Array.isArray(digest.sections?.bills) ? digest.sections.bills : [];
  const highlights = Array.isArray(digest.highlights) ? digest.highlights.slice(0, 6) : [];
  const actions = Array.isArray(digest.actions) ? digest.actions.slice(0, 8) : [];
  const topSenders = Array.isArray(digest.topSenders) ? digest.topSenders.slice(0, 6) : [];
  const summary = digest.summary || "No digest available.";
  const strategy = digest?._meta?.strategy || "unknown";
  const model = digest?._meta?.model || "local-route";
  const confidence = typeof digest?._meta?.confidence === "number"
    ? `${Math.round(digest._meta.confidence * 100)}%`
    : "-";
  const totalSignals = meetings.length + bills.length + actions.length;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.2)]">
        <div className="relative shrink-0 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-5 text-white">
          <div className="absolute -right-12 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute left-0 bottom-0 h-px w-full bg-white/20" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/80">AI Tools</p>
              <h2 className="mt-1 text-2xl font-semibold">Daily Digest</h2>
              <p className="mt-1 text-sm text-white/85">Minimal brief of what matters in your inbox right now.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/35 p-2 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-slate-700">Crafting your digest...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Strategy</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    {strategy}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Confidence</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900">{confidence}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Signals</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900">{totalSignals}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Model</p>
                  <p className="mt-1 truncate text-[13px] font-semibold text-slate-900">{model}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Cache</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900">
                    {digest?._meta?.cached ? "hit" : "fresh"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[15px] font-semibold text-slate-900">Summary</h3>
                </div>
                <p className="text-[14px] leading-relaxed text-slate-700 whitespace-pre-wrap">{summary}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-rose-500" />
                    <h3 className="text-[15px] font-semibold text-slate-900">Action Items</h3>
                  </div>
                  {actions.length === 0 && <p className="text-sm text-slate-500">No action items detected.</p>}
                  <div className="space-y-2">
                    {actions.map((a: DigestAction, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{a.text}</p>
                        {a.due && (
                          <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                            {a.due}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <h3 className="text-[15px] font-semibold text-slate-900">Highlights</h3>
                  </div>
                  {highlights.length === 0 && <p className="text-sm text-slate-500">No highlights detected.</p>}
                  <div className="space-y-2">
                    {highlights.map((h: string, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-[15px] font-semibold text-slate-900">Top Senders</h3>
                  </div>
                  {topSenders.length === 0 && <p className="text-sm text-slate-500">No sender data.</p>}
                  <div className="space-y-2">
                    {topSenders.map((s: DigestSender, idx: number) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="truncate text-sm text-slate-700">{s.sender}</p>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-cyan-600" />
                    <h3 className="text-[15px] font-semibold text-slate-900">Meetings & Bills</h3>
                  </div>
                  <div className="space-y-2">
                    {meetings.slice(0, 4).map((m, idx) => (
                      <div key={`m-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{m.subject || "Meeting detected"}</p>
                        {m.date && <p className="mt-1 text-xs text-slate-500">{m.date}</p>}
                      </div>
                    ))}
                    {bills.slice(0, 3).map((b, idx) => (
                      <div key={`b-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{b.subject || "Billing update"}</p>
                        <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                          <UserRound className="h-3 w-3" />
                          {b.from || "Unknown sender"}
                          {Array.isArray(b.amounts) && b.amounts[0] ? ` • ${b.amounts[0]}` : ""}
                        </p>
                      </div>
                    ))}
                    {meetings.length === 0 && bills.length === 0 && (
                      <p className="text-sm text-slate-500">No meetings or bills detected.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
