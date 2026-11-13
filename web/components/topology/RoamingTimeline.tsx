"use client";

import { useRef, useState } from "react";
import type { RoamSession } from "@/web/lib/roamingHistory";
import { cn } from "@/web/lib/utils";
import { FloatingTip, pointAnchor } from "@/web/components/ui/FloatingTip";

export const shortTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function shortDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "< 1m";
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${min}m` : `${min}m`;
}

/** Within this many pixels a thin segment still counts as under the pointer. */
const SNAP_PX = 4;
const BUBBLE_W = 232;

type Hit = { x: number } & ({ kind: "session"; session: RoamSession } | { kind: "gap"; start: number; end: number });

/**
 * The window as one bar: a coloured segment per association (colour = access point), grey = not
 * connected. Hovering anywhere on it (or focusing a segment) shows that connection — or gap — in a
 * bubble under the pointer, drawn at page level so the panel's scroll area can't hide it.
 */
export function RoamingTimeline({ sessions, from, to, colourOf, labelOf, linesOf, axis = true }: {
  sessions: RoamSession[];
  from: number;
  to: number;
  colourOf: (ap: string) => string;
  labelOf: (ap: string) => string;
  /** Detail lines for a connection's bubble (band · channel · signal, how it ended). */
  linesOf: (s: RoamSession) => string[];
  /** The time axis under the bar (off for all but the last of several stacked bars). */
  axis?: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState<Hit | null>(null);
  const span = Math.max(to - from, 1);
  const pct = (t: number) => ((Math.min(Math.max(t, from), to) - from) / span) * 100;

  /** The connection at pointer x, else the nearest within SNAP_PX, else the gap around it. */
  function hitAt(x: number, width: number): Hit {
    const t = from + (x / width) * span;
    const snap = (SNAP_PX / width) * span;
    const inside = sessions.find((s) => t >= s.start && t <= s.end);
    const near = inside ?? sessions
      .map((s) => ({ s, d: t < s.start ? s.start - t : t - s.end }))
      .filter((c) => c.d <= snap)
      .sort((a, b) => a.d - b.d)[0]?.s;
    if (near) return { x, kind: "session", session: near };
    const start = Math.max(from, ...sessions.filter((s) => s.end <= t).map((s) => s.end));
    const end = Math.min(to, ...sessions.filter((s) => s.start >= t).map((s) => s.start));
    return { x, kind: "gap", start, end };
  }

  const onMove = (e: React.MouseEvent) => {
    const r = barRef.current?.getBoundingClientRect();
    if (r && r.width > 0) setHit(hitAt(Math.min(Math.max(e.clientX - r.left, 0), r.width), r.width));
  };

  const bar = hit ? barRef.current?.getBoundingClientRect() : undefined;

  return (
    <div className={axis ? "mb-3" : "mb-2"}>
      <div className="relative">
        <div
          ref={barRef}
          className="relative h-4 cursor-crosshair overflow-hidden rounded-md bg-neutral-100"
          onMouseMove={onMove}
          onMouseLeave={() => setHit(null)}
        >
          {sessions.map((s) => {
            const left = pct(s.start);
            const w = Math.max(pct(s.end) - left, 0);
            return (
              <button
                key={`${s.start}-${s.ap}`}
                type="button"
                aria-label={`${labelOf(s.ap)}, ${shortTime(s.start)}, ${shortDuration(s.end - s.start)}`}
                onFocus={() => setHit({ x: ((left + w / 2) / 100) * (barRef.current?.offsetWidth ?? 0), kind: "session", session: s })}
                onBlur={() => setHit(null)}
                className={cn(
                  "absolute inset-y-0 min-w-[2px] border-l border-white/70 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600",
                  colourOf(s.ap),
                  hit?.kind === "session" && hit.session === s && "brightness-110 saturate-150"
                )}
                style={{ left: `${left}%`, width: `${w}%` }}
              />
            );
          })}
          {hit && <span className="pointer-events-none absolute inset-y-0 w-px bg-neutral-900/40" style={{ left: hit.x }} />}
        </div>

        {hit && bar && (
          <FloatingTip
            anchor={pointAnchor(bar.left + hit.x, bar.bottom)} arrow onScrollAway={() => setHit(null)}
            className="rounded-lg bg-neutral-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg"
          >
            <div style={{ width: BUBBLE_W - 20 }}>
              {hit.kind === "session" ? (
                <>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className={cn("h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-white/60", colourOf(hit.session.ap))} />
                    <span className="truncate">{labelOf(hit.session.ap)}</span>
                  </div>
                  <div className="mt-0.5 text-neutral-300">
                    {shortTime(hit.session.start)} · <span className="whitespace-nowrap">{shortDuration(hit.session.end - hit.session.start)}</span>
                  </div>
                  {linesOf(hit.session).filter(Boolean).map((line) => <div key={line}>{line}</div>)}
                </>
              ) : (
                <>
                  <div className="font-semibold">Not connected</div>
                  <div className="mt-0.5 text-neutral-300">
                    {shortTime(hit.start)} – {shortTime(hit.end)} · <span className="whitespace-nowrap">{shortDuration(hit.end - hit.start)}</span>
                  </div>
                </>
              )}
            </div>
          </FloatingTip>
        )}
      </div>
      {axis && <div className="mt-1 flex justify-between gap-2 text-[10px] text-neutral-400">
        <span>{shortTime(from)}</span>
        <span>Hover for details · grey = not connected</span>
        <span>now</span>
      </div>}
    </div>
  );
}
