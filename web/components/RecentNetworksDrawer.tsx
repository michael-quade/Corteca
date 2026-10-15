"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/web/lib/utils";
import type { RecentNetwork } from "@/web/lib/recentNetworks";

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export interface RecentNetworksDrawerProps {
  entries: RecentNetwork[];
  currentId: string | null;
  onPick: (entry: RecentNetwork) => void;
  onClear: () => void;
}

/**
 * Thin rail on the left edge; opens an overlay panel (so the diagram keeps its
 * full width) listing networks viewed in this browser.
 */
export function RecentNetworksDrawer({ entries, currentId, onPick, onClear }: RecentNetworksDrawerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    // self-stretch gives the sticky inner wrapper the page height to travel in.
    <div className="z-30 flex-shrink-0 self-stretch">
    <div ref={ref} className="sticky top-16">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Recent networks"
        title="Recent networks"
        className={cn(
          "flex w-9 flex-col items-center gap-2 rounded-xl border py-3 text-neutral-500 transition-colors",
          open ? "border-violet-300 bg-violet-50 text-violet-700" : "border-neutral-200 bg-white hover:border-neutral-400 hover:text-neutral-800"
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">Recent</span>
        {entries.length > 0 && <span className="rounded-full bg-neutral-900 px-1.5 text-[10px] font-semibold text-white">{entries.length}</span>}
      </button>

      {open && (
        <aside className="absolute left-11 top-0 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-neutral-900">Recent networks</h2>
            {entries.length > 0 && (
              <button type="button" onClick={onClear} className="text-xs text-neutral-500 hover:text-red-600">Clear</button>
            )}
          </header>
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">Networks you open will appear here.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {entries.map((r) => {
                const online = r.subscriber?.home_wifis?.[0]?.status?.online;
                return (
                  <li key={r.networkId}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onPick(r); }}
                      className={cn("flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-violet-50", r.networkId === currentId && "bg-violet-50/60")}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-900">
                          {r.subscriber && <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} />}
                          {r.label}
                        </span>
                        <span className="block font-mono text-[11px] text-neutral-400">{r.networkId}</span>
                      </span>
                      <span className="flex-shrink-0 text-[11px] text-neutral-400">{r.networkId === currentId ? "current" : ago(r.viewedAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      )}
    </div>
    </div>
  );
}
