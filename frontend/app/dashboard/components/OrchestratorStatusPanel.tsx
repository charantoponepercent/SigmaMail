"use client";

import { BrainCircuit, Clock3, Database, RefreshCw, Sparkles, Trash2, X } from "lucide-react";

type OrchestratorStatusItem = {
  at: string;
  task: string;
  strategy: string;
  confidence: number | null;
  model: string | null;
  latencyMs: number | null;
  cached?: boolean;
  error?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: OrchestratorStatusItem[];
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
};

function shortAgo(iso?: string) {
  if (!iso) return "now";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function taskLabel(task = "") {
  if (task === "summary_intent") return "Intent Detection";
  if (task === "thread_summary") return "Thread Summarization";
  if (task === "daily_digest") return "Daily Digest";
  if (task === "action_decision") return "Action Decision";
  return task.replaceAll("_", " ");
}

function strategyTone(strategy = "") {
  if (strategy.includes("fallback")) {
    return {
      chip: "bg-amber-100 text-amber-800",
      dot: "bg-amber-500",
      flow: "from-amber-200 to-amber-100",
    };
  }
  if (strategy.includes("cache")) {
    return {
      chip: "bg-sky-100 text-sky-800",
      dot: "bg-sky-500",
      flow: "from-sky-200 to-sky-100",
    };
  }
  if (strategy.includes("heuristic")) {
    return {
      chip: "bg-slate-100 text-slate-700",
      dot: "bg-slate-500",
      flow: "from-slate-200 to-slate-100",
    };
  }
  return {
    chip: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    flow: "from-emerald-200 to-emerald-100",
  };
}

function formatError(error?: string | null) {
  if (!error) return "";
  if (error.includes("Gemini network request failed")) return "Gemini network fetch failed";
  if (error.includes("Gemini API key is invalid")) return "Gemini API key invalid";
  if (error.includes("Gemini request timed out")) return "Gemini timeout";
  if (error.includes("Gemini model not found")) return "Gemini model not found";
  return error;
}

export default function OrchestratorStatusPanel({
  open,
  onClose,
  items,
  loading,
  onRefresh,
  onClear,
}: Props) {
  if (!open) return null;

  const latest = items[0];

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/35 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-2xl overflow-hidden">
        <div className="relative border-b border-slate-100 px-6 pt-6 pb-5">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="absolute -left-14 -bottom-16 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">AI Tools</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Orchestrator Flow</h2>
              <p className="mt-1 text-sm text-slate-500">
                Real-time path of task routing, model choice, confidence, and latency.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            {latest && (
              <>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  Latest: {taskLabel(latest.task)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {shortAgo(latest.at)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-5">
          {loading && items.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Loading orchestrator events...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
              <p className="text-sm text-slate-600">No orchestrator events yet.</p>
              <p className="text-xs text-slate-500 mt-1">Run classify, digest, or thread summary once.</p>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-3">
              {items.slice(0, 12).map((item, index) => {
                const tone = strategyTone(item.strategy);
                const isLast = index === Math.min(items.length, 12) - 1;

                return (
                  <div key={`${item.at}-${index}`} className="relative pl-7">
                    {!isLast && (
                      <div className="absolute left-[9px] top-7 h-[calc(100%+18px)] w-px bg-slate-200" />
                    )}
                    <div className={`absolute left-0 top-2 h-[18px] w-[18px] rounded-full border-4 border-white shadow ${tone.dot}`} />

                    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${tone.flow} p-[1px]`}>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold text-slate-900">{taskLabel(item.task)}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{shortAgo(item.at)}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}>
                            {item.strategy}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="text-[10px] text-slate-500">Confidence</p>
                            <p className="mt-0.5 text-[12px] font-semibold text-slate-800">
                              {typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}%` : "-"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="text-[10px] text-slate-500">Model</p>
                            <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-800 flex items-center gap-1">
                              <BrainCircuit className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{item.model || "local-route"}</span>
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="text-[10px] text-slate-500">Latency</p>
                            <p className="mt-0.5 text-[12px] font-semibold text-slate-800 flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5 text-cyan-600" />
                              {typeof item.latencyMs === "number" ? `${item.latencyMs} ms` : "-"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                          <Database className="h-3.5 w-3.5 text-slate-400" />
                          {item.cached ? "Result served from cache" : "Fresh execution path"}
                        </div>

                        {item.error && (
                          <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
                            {formatError(item.error)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
