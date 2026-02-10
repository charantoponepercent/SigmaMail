"use client";

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

function shortAgo(iso?: string) {
  if (!iso) return "now";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function strategyClass(strategy = "") {
  if (strategy.includes("fallback")) return "bg-amber-100 text-amber-700";
  if (strategy.includes("cache")) return "bg-sky-100 text-sky-700";
  if (strategy.includes("heuristic")) return "bg-slate-100 text-slate-700";
  return "bg-emerald-100 text-emerald-700";
}

type Props = {
  items: OrchestratorStatusItem[];
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
};

function formatError(error?: string | null) {
  if (!error) return "";
  if (error.includes("Gemini network request failed")) {
    return "Gemini network fetch failed";
  }
  if (error.includes("Gemini API key is invalid")) {
    return "Gemini API key invalid";
  }
  if (error.includes("Gemini request timed out")) {
    return "Gemini timeout";
  }
  if (error.includes("Gemini model not found")) {
    return "Gemini model not found";
  }
  return error;
}

export default function OrchestratorStatusPanel({ items, loading, onRefresh, onClear }: Props) {
  return (
    <div className="mx-3 mt-2 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-indigo-700 uppercase">
            AI Orchestrator
          </p>
          <p className="text-[11px] text-gray-500">
            Task, strategy, confidence, model, latency
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        >
          Clear history
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="mt-3 text-[12px] text-gray-500">Loading status...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="mt-3 text-[12px] text-gray-500">
          No orchestrator activity yet. Run summary/classify/digest once.
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
          {items.slice(0, 8).map((item, idx) => (
            <div key={`${item.at}-${idx}`} className="rounded-lg border border-gray-200 bg-white px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-gray-800 truncate">
                  {item.task}
                </p>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {shortAgo(item.at)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strategyClass(item.strategy)}`}>
                  {item.strategy}
                </span>
                {typeof item.confidence === "number" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {Math.round(item.confidence * 100)}%
                  </span>
                )}
                {typeof item.latencyMs === "number" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {item.latencyMs}ms
                  </span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-gray-500 truncate">
                {item.model || "local-route"}
              </div>
              {item.error && (
                <div className="mt-1 text-[10px] text-red-600 truncate">
                  {formatError(item.error)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
