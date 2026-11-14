"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "@/web/lib/utils";
import { setSectionCollapsed, useCollapsedSections } from "./useSectionCollapse";
import { arrangeSections, useSectionOrder } from "./useSectionOrder";

// Short chip names for the longer section titles; others use the section id as is.
const SHORT: Record<string, string> = {
  "Top clients by traffic": "Top clients",
  "Ethernet ports": "Ports",
  "Backhaul link": "Backhaul",
  "Roaming history": "Roaming",
  "Backhaul history": "Backhaul",
  "Device events": "Events",
  "Inferred switch": "Switch",
  "Wired clients": "Wired",
  "Other hosts on the port": "Other hosts",
  "WAN interface": "Interface",
  "WAN port": "WAN port",
};

/** How far below the top of the scroll area a section may start and still count as current (before the last screenful). */
const SPY_SLACK = 8;

type Drop = { index: number; side: "before" | "after" };

/** `ids` with `id` moved to sit before / after `target`'s position. */
function moved(ids: string[], id: string, drop: Drop): string[] {
  const rest = ids.filter((x) => x !== id);
  const target = ids[drop.index];
  const at = target === id ? ids.indexOf(id) : rest.indexOf(target) + (drop.side === "after" ? 1 : 0);
  rest.splice(at, 0, id);
  return rest;
}

/**
 * A fixed row of chips under a detail panel's title, one per `DetailSection` in `scrollRef`
 * (found by `data-section`, so every panel gets it without listing its sections). The chip
 * of the section at the top of the scroll area is highlighted and follows scrolling; a click
 * scrolls to that section and unfolds it. Folded sections end in "›".
 *
 * Dragging a chip (or Alt + ←/→ on a focused chip) moves its section: the order is saved per
 * panel `kind` in this browser and applied with CSS `order` on the sections (the scroll area is a
 * flex column), so the panels' code keeps its built-in order; `SectionOrderReset` (in the
 * panel header) restores it.
 * `resetKey` (the selection) re-scans when the panel shows another device.
 */
export function SectionChips({ scrollRef, resetKey, kind }: {
  scrollRef: RefObject<HTMLDivElement | null>;
  resetKey: string;
  kind: string;
}) {
  const [present, setPresent] = useState<string[]>([]);
  const [saved, save] = useSectionOrder(kind);
  const ids = useMemo(() => arrangeSections(present, saved), [present, saved]);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const [current, setCurrent] = useState(0);
  const folded = useCollapsedSections();
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const focusAfterMove = useRef<string | null>(null);
  const rowRef = useRef<HTMLElement>(null);
  // After a chip click the clicked chip stays current until the user scrolls themselves —
  // a short last section can't reach the top, so the spy alone would pick another one.
  const locked = useRef<number | null>(null);

  /** Sections in the order shown. */
  const sections = useCallback(() => {
    const list = [...(scrollRef.current?.querySelectorAll<HTMLElement>("section[data-section]") ?? [])];
    const order = idsRef.current;
    return list.sort((a, b) => order.indexOf(a.dataset.section ?? "") - order.indexOf(b.dataset.section ?? ""));
  }, [scrollRef]);

  /** Shows the sections in `order` (CSS order; the first one drops its top rule). */
  const apply = useCallback((order: string[]) => {
    for (const s of scrollRef.current?.querySelectorAll<HTMLElement>("section[data-section]") ?? []) {
      const i = order.indexOf(s.dataset.section ?? "");
      s.style.order = String(i < 0 ? order.length : i);
      s.style.borderTopWidth = i === 0 ? "0px" : "1px";
    }
  }, [scrollRef]);

  const spy = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (locked.current != null) { setCurrent(locked.current); return; }
    // The current section is the last one starting above a reading line. Short sections at
    // the end never reach the top, so over the last screenful of scrolling (or the whole
    // range, when there's less) the line slides from the top down to the bottom: every
    // section gets its turn, in order, and the bottom of the scroll lands on the last one.
    const max = el.scrollHeight - el.clientHeight;
    const stretch = Math.min(max, el.clientHeight);
    const progress = stretch > 0 ? Math.min(1, Math.max(0, (el.scrollTop - (max - stretch)) / stretch)) : 0;
    const line = SPY_SLACK + progress * (el.clientHeight - SPY_SLACK);
    const top = el.getBoundingClientRect().top;
    let cur = 0;
    sections().forEach((s, i) => { if (s.getBoundingClientRect().top - top <= line) cur = i; });
    setCurrent(cur);
  }, [scrollRef, sections]);

  // Sections appear late (gateway reads, events, roaming), so re-scan on DOM changes; a new
  // section gets its place in the same frame, so it never flashes at the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    locked.current = null;
    let frame = 0;
    const scan = () => {
      const next = [...el.querySelectorAll<HTMLElement>("section[data-section]")].map((s) => s.dataset.section ?? "");
      apply(arrangeSections(next, savedRef.current));
      setPresent((prev) => (prev.join("|") === next.join("|") ? prev : next));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(spy);
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
  }, [scrollRef, apply, spy, resetKey]);

  // A new saved order (drag, keys, reset, another panel): re-apply, keep focus on a moved chip.
  useEffect(() => {
    apply(ids);
    locked.current = null;
    requestAnimationFrame(spy);
    const f = focusAfterMove.current;
    if (f) {
      focusAfterMove.current = null;
      rowRef.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(f)}"]`)?.focus();
    }
  }, [ids, apply, spy]);

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

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    e.stopPropagation();
    const j = i + (e.key === "ArrowLeft" ? -1 : 1);
    if (j < 0 || j >= ids.length) return;
    focusAfterMove.current = ids[i];
    save(moved(ids, ids[i], { index: j, side: j < i ? "before" : "after" }));
  };

  const endDrag = () => { setDragId(null); setDrop(null); };

  if (ids.length < 2) return null;
  return (
    <nav
      ref={rowRef}
      aria-label="Sections"
      className="flex flex-shrink-0 flex-wrap items-center gap-1 border-b border-neutral-100 px-3 py-2"
    >
      {ids.map((id, i) => (
        <button
          key={id}
          data-chip={id}
          type="button"
          draggable
          onClick={() => jump(i)}
          onKeyDown={(e) => onKeyDown(e, i)}
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; setDragId(id); }}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            const side = e.clientX < r.left + r.width / 2 ? "before" : "after";
            if (drop?.index !== i || drop.side !== side) setDrop({ index: i, side });
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && drop) save(moved(ids, dragId, drop));
            endDrag();
          }}
          onDragEnd={endDrag}
          aria-current={i === current ? "true" : undefined}
          title={`${folded.has(id) ? `${id} (minimised) — show` : `Go to ${id}`} · drag, or Alt + ←/→, to move it`}
          className={cn(
            "relative cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors active:cursor-grabbing",
            i === current
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-neutral-200 bg-white hover:border-blue-600 hover:text-blue-700",
            i !== current && (folded.has(id) ? "text-neutral-400" : "text-neutral-700"),
            dragId === id && "opacity-40",
            // Where the dragged chip would land.
            drop?.index === i && dragId !== id && "before:absolute before:inset-y-0.5 before:w-0.5 before:rounded-full before:bg-blue-600 before:content-['']",
            drop?.index === i && dragId !== id && (drop.side === "before" ? "before:-left-[3.5px]" : "before:-right-[3.5px]"),
          )}
        >
          {SHORT[id] ?? id}{folded.has(id) && " ›"}
        </button>
      ))}
    </nav>
  );
}

/** Header button that restores the built-in section order; shown only once the user has moved sections. */
export function SectionOrderReset({ kind }: { kind: string }) {
  const [saved, , reset] = useSectionOrder(kind);
  if (!saved) return null;
  return (
    <button
      type="button"
      onClick={reset}
      title="Restore the built-in section order"
      aria-label="Restore the built-in section order"
      className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
      </svg>
    </button>
  );
}
