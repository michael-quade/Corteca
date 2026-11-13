"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/web/lib/utils";
import { setSectionCollapsed, useCollapsedSections } from "./useSectionCollapse";

// Short chip names for the longer section titles; others use the section id as is.
const SHORT: Record<string, string> = {
  "Top clients by traffic": "Top clients",
  "Ethernet ports": "Ports",
  "Backhaul link": "Backhaul",
  "Roaming history": "Roaming",
  "Device events": "Events",
  "Inferred switch": "Switch",
  "Wired clients": "Wired",
  "Other hosts on the port": "Other hosts",
  "WAN interface": "Interface",
  "WAN port": "WAN port",
};

/** How far below the top of the scroll area a section may start and still count as current. */
const SPY_SLACK = 8;

/**
 * A fixed row of chips under a detail panel's title, one per `DetailSection` in `scrollRef`
 * (found by `data-section`, so every panel gets it without listing its sections). The chip
 * of the section at the top of the scroll area is highlighted and follows scrolling; a click
 * scrolls to that section and unfolds it. Folded sections end in "›". `resetKey` (the
 * selection) re-scans when the panel shows another device.
 */
export function SectionChips({ scrollRef, resetKey }: { scrollRef: RefObject<HTMLDivElement | null>; resetKey: string }) {
  const [ids, setIds] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const folded = useCollapsedSections();
  const rowRef = useRef<HTMLDivElement>(null);
  // After a chip click the clicked chip stays current until the user scrolls themselves —
  // a short last section can't reach the top, so the spy alone would pick another one.
  const locked = useRef<number | null>(null);

  const sections = useCallback(
    () => [...(scrollRef.current?.querySelectorAll<HTMLElement>("section[data-section]") ?? [])],
    [scrollRef],
  );

  const spy = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (locked.current != null) { setCurrent(locked.current); return; }
    const top = el.getBoundingClientRect().top;
    const list = sections();
    let cur = 0;
    list.forEach((s, i) => { if (s.getBoundingClientRect().top - top <= SPY_SLACK) cur = i; });
    if (el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) cur = list.length - 1;
    setCurrent(cur);
  }, [scrollRef, sections]);

  // Sections appear late (gateway reads, events, roaming), so re-scan on DOM changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    locked.current = null;
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = sections().map((s) => s.dataset.section ?? "");
        setIds((prev) => (prev.join("|") === next.join("|") ? prev : next));
        spy();
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    const unlock = () => { locked.current = null; };
    el.addEventListener("scroll", spy, { passive: true });
    for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) el.addEventListener(t, unlock, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      el.removeEventListener("scroll", spy);
      for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) el.removeEventListener(t, unlock);
    };
  }, [scrollRef, sections, spy, resetKey]);

  // Keep the current chip visible in the row.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.children[current] as HTMLElement | undefined;
    if (!row || !chip) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
    }
  }, [current, ids]);

  const jump = (i: number) => {
    const id = ids[i];
    if (folded.has(id)) setSectionCollapsed(id, false);
    locked.current = i;
    setCurrent(i);
    // Unfolding changes the layout, so measure on the next frame.
    requestAnimationFrame(() => {
      const el = scrollRef.current, s = sections()[i];
      if (!el || !s) return;
      el.scrollTo({ top: el.scrollTop + s.getBoundingClientRect().top - el.getBoundingClientRect().top, behavior: "smooth" });
    });
  };

  if (ids.length < 2) return null;
  return (
    <nav
      ref={rowRef}
      aria-label="Sections"
      className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-neutral-100 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ids.map((id, i) => (
        <button
          key={id}
          type="button"
          onClick={() => jump(i)}
          aria-current={i === current ? "true" : undefined}
          title={folded.has(id) ? `${id} (minimised) — show` : `Go to ${id}`}
          className={cn(
            "whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
            i === current
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-neutral-200 bg-white hover:border-blue-600 hover:text-blue-700",
            i !== current && (folded.has(id) ? "text-neutral-400" : "text-neutral-700"),
          )}
        >
          {SHORT[id] ?? id}{folded.has(id) && " ›"}
        </button>
      ))}
    </nav>
  );
}
