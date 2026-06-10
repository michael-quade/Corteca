"use client";

import { useState } from "react";
import { cn } from "@/web/lib/utils";
import { useApiLog, type ApiLogEntry } from "@/web/contexts/ApiLogContext";

function fmtTime(d: Date): string {
  const hms = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${hms}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function formatBody(raw: string | null): string {
  if (raw === null) return "Loading…";
  if (!raw.trim()) return "(empty response)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function entryToText(e: ApiLogEntry): string {
  const body = e.body !== null ? formatBody(e.body) : "(pending)";
  return `[${fmtTime(e.timestamp)}] ${e.method} ${e.url}  →  ${e.status} ${e.statusText} (${e.durationMs}ms)\n${body}`;
}

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-cyan-400",
  POST:   "text-green-400",
  PUT:    "text-blue-400",
  DELETE: "text-red-400",
  PATCH:  "text-amber-400",
};

function StatusBadge({ status }: { status: number }) {
  const cls = status >= 500 ? "text-red-400"
    : status >= 400 ? "text-amber-400"
    : status >= 300 ? "text-blue-400"
    : "text-emerald-400";
  return <span className={cn("font-mono font-bold", cls)}>{status}</span>;
}

function LogRow({ entry }: { entry: ApiLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const methodColor = METHOD_COLOR[entry.method] ?? "text-neutral-400";
  const isError = entry.status >= 400;

  return (
    <div className={cn("border-b border-neutral-800 last:border-0", isError && "bg-red-950/20")}>
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-white/5"
      >
        <span className="shrink-0 font-mono text-[11px] text-neutral-500">{fmtTime(entry.timestamp)}</span>
        <span className={cn("w-14 shrink-0 font-mono text-xs font-bold", methodColor)}>{entry.method}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-300">{entry.url}</span>
        <StatusBadge status={entry.status} />
        <span className="shrink-0 font-mono text-[11px] text-neutral-500">{entry.durationMs}ms</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={cn("shrink-0 text-neutral-600 transition-transform", expanded ? "rotate-180" : "")}
        >
          <path d="M2 3l3 3 3-3" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-2">
          <pre className="max-h-64 overflow-auto font-mono text-[11px] leading-relaxed text-neutral-300 whitespace-pre-wrap break-all">
            {formatBody(entry.body)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ApiLogPanel() {
  const { entries, clear } = useApiLog();
  const [open, setOpen] = useState(false);

  function copyAll() {
    const text = entries.map(entryToText).join("\n\n---\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const errorCount = entries.filter((e) => e.status >= 400).length;

  return (
    <div className="border-t border-neutral-800 bg-neutral-900 text-white">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white"
        >
          <svg
            width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={cn("transition-transform", open ? "rotate-180" : "")}
          >
            <path d="M2 3l3 3 3-3" />
          </svg>
          API Log
        </button>

        {entries.length > 0 && (
          <span className="rounded-full bg-neutral-700 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
            {entries.length} call{entries.length !== 1 ? "s" : ""}
          </span>
        )}
        {errorCount > 0 && (
          <span className="rounded-full bg-red-900/60 px-2 py-0.5 font-mono text-[11px] text-red-400">
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {entries.length > 0 && (
            <>
              <button
                type="button"
                onClick={copyAll}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
              >
                Copy All
              </button>
              <button
                type="button"
                onClick={clear}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Log entries */}
      {open && (
        <div className="border-t border-neutral-800">
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center font-mono text-xs text-neutral-600">
              No API calls on this page yet.
            </p>
          ) : (
            entries.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
}
