"use client";

import { useState, type ReactNode } from "react";
import { ROAMING_DAYS, type RoamSession } from "@/web/lib/roamingHistory";
import { cn } from "@/web/lib/utils";
import { shortDuration, shortTime } from "./RoamingTimeline";

// Pieces shared by the client panel's "Roaming history" and the AP panel's "Backhaul history".

export const ROAM_RANGES = [1, 7, ROAMING_DAYS];
export const rangeText = (days: number) => (days === 1 ? "24 h" : `${days} days`);
export const countText = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One colour per access point (not status colours); most-used AP first.
const AP_COLOURS = ["bg-violet-500", "bg-sky-500", "bg-indigo-300", "bg-fuchsia-400", "bg-slate-500", "bg-cyan-300"];

export function apColours(timePerAp: { ap: string }[]): (mac: string) => string {
  const colours = new Map(timePerAp.map((t, i) => [t.ap, AP_COLOURS[i % AP_COLOURS.length]]));
  return (mac) => colours.get(mac) ?? "bg-neutral-400";
}

export function PeriodSwitch({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Period">
      {ROAM_RANGES.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={days === d}
          onClick={() => onChange(d)}
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            days === d ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-neutral-500 hover:bg-neutral-100"
          )}
        >
          {rangeText(d)}
        </button>
      ))}
    </div>
  );
}

export function HistoryLoading() {
  return (
    <p className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
      Reading Corteca&apos;s history…
    </p>
  );
}

/** Label / value rows ("Moves between APs  3"); rows with `hideZero` are left out at 0. */
export function CountRows({ rows }: { rows: { label: string; value: number; hideZero?: boolean }[] }) {
  return (
    <dl className="mb-3 space-y-1.5 text-xs">
      {rows.filter((r) => !(r.hideZero && r.value === 0)).map((r) => (
        <div key={r.label} className="flex justify-between gap-3">
          <dt className="text-neutral-500">{r.label}</dt>
          <dd className="font-medium text-neutral-800">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Time on each AP": coloured dot, AP link, share of the total · duration. */
export function TimeShare({ title, caption, rows, colourOf, renderAp }: {
  title: string;
  caption: string;
  rows: { ap: string; ms: number }[];
  colourOf: (mac: string) => string;
  renderAp: (mac: string) => ReactNode;
}) {
  const total = rows.reduce((n, t) => n + t.ms, 0) || 1;
  return (
    <>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 border-t border-neutral-100 pt-2 text-[11px]">
        <span className="font-semibold text-neutral-700">{title}</span>
        <span className="text-neutral-400">{caption}</span>
      </div>
      <dl className="mb-3 space-y-1.5 text-xs">
        {rows.map((t) => (
          <div key={t.ap} className="flex items-center justify-between gap-3">
            <dt className="flex min-w-0 items-center gap-1.5 text-neutral-500">
              <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", colourOf(t.ap))} />
              <span className="truncate">{renderAp(t.ap)}</span>
            </dt>
            <dd className="flex-shrink-0 font-medium text-neutral-800">{`${Math.round((t.ms / total) * 100)}% · ${shortDuration(t.ms)}`}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export interface SessionItem {
  key: string;
  session: RoamSession;
  /** Small pills after the AP ("Roamed", "6 GHz"). */
  tags?: { text: string; tone: "blue" | "grey" }[];
  lines: string[];
}

const LIST_LIMIT = 6;

/** Connections newest first (pass them so), the first six with "Show all". */
export function SessionList({ items, colourOf, renderAp }: {
  items: SessionItem[];
  colourOf: (mac: string) => string;
  renderAp: (mac: string) => ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const listed = showAll ? items : items.slice(0, LIST_LIMIT);
  return (
    <>
      <ol className="-mx-2 space-y-0.5">
        {listed.map(({ key, session: s, tags, lines }) => (
          <li key={key} className="rounded-lg px-2 py-1.5 hover:bg-neutral-50">
            <div className="flex justify-between gap-2 text-[11px] text-neutral-500">
              <span>{s.startedBefore ? `Before ${shortTime(s.start)}` : shortTime(s.start)}</span>
              <span>{shortDuration(s.end - s.start)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-800">
              <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", colourOf(s.ap))} />
              {renderAp(s.ap)}
              {tags?.map((t) => (
                <span key={t.text} className={cn("rounded-full px-1.5 text-[10px] font-medium", t.tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600")}>
                  {t.text}
                </span>
              ))}
            </div>
            {lines.filter(Boolean).map((l, i) => (
              <div key={i} className={cn("text-[11px]", i === 0 ? "text-neutral-600" : "text-neutral-500")}>{l}</div>
            ))}
          </li>
        ))}
      </ol>
      {items.length > LIST_LIMIT && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700">
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}
