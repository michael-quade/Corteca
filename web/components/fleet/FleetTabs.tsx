"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/web/lib/utils";
import { FLEET_TABS, type FleetTabId } from "@/web/lib/fleet/fleetTabs";

export type BadgeTone = "red" | "amber" | "blue";
export interface TabBadge { text: string; tone: BadgeTone; hint?: string }

const BADGE: Record<BadgeTone, string> = {
  red: "bg-red-100 text-red-700",
  amber: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-50 text-blue-700",
};

/**
 * Fleet Metrics tab strip: one tab per view, the active one raised onto the page with a blue
 * top edge. A badge shows what needs attention once that view's data is in (red = critical,
 * amber = warning, blue = info). ←/→ move between tabs.
 */
export function FleetTabs({ active, badges, onSelect }: {
  active: FleetTabId;
  badges: Partial<Record<FleetTabId, TabBadge>>;
  onSelect: (id: FleetTabId) => void;
}) {
  const refs = useRef(new Map<FleetTabId, HTMLButtonElement>());

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = FLEET_TABS.findIndex((t) => t.id === active);
    const next = FLEET_TABS[(i + (e.key === "ArrowRight" ? 1 : FLEET_TABS.length - 1)) % FLEET_TABS.length].id;
    onSelect(next);
    refs.current.get(next)?.focus();
  };

  return (
    <div role="tablist" aria-label="Fleet views" onKeyDown={onKey} className="flex flex-wrap gap-1 border-b border-neutral-200">
      {FLEET_TABS.map((t) => {
        const on = t.id === active;
        const badge = badges[t.id];
        return (
          <button
            key={t.id}
            ref={(el) => { if (el) refs.current.set(t.id, el); }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(t.id)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40",
              on
                ? "border-neutral-200 bg-white font-semibold text-blue-700 shadow-[inset_0_2px_0_0_#2563eb]"
                : "border-transparent text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
            )}
          >
            {t.label}
            {badge && (
              <span title={badge.hint} className={cn("rounded-full px-2 py-px text-[11px] font-semibold tabular-nums", BADGE[badge.tone])}>
                {badge.text}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
