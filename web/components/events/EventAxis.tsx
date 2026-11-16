"use client";

import { useEffect, useRef, useState } from "react";
import { dateOnly, startOfDay } from "@/web/lib/eventFormat";

const DAY_STEPS = [1, 2, 3, 7, 14];
const HOUR_STEPS = [1, 2, 3, 6, 12];
/** Least room between two labels' centres. */
const MIN_GAP = 60;
/** Rough width of a 10 px label character, to keep the end labels inside the axis. */
const CHAR_PX = 5.6;

const hourText = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric" });

export interface AxisTick { index: number; text: string }

/**
 * Which slots get a label: evenly spaced, counted back from the newest slot, the step picked
 * from the axis width (`slotPx` = one slot's width); the oldest slot too when there is room.
 * Days read "Oct 27" (the newest "Today" when it is today); hours "6 AM", with the date at
 * midnight and on the first label, the newest "Now" when it is the current hour.
 */
export function axisTicks(slots: { start: number }[], hourly: boolean, slotPx: number, now = Date.now()): AxisTick[] {
  const n = slots.length;
  if (!n || slotPx <= 0) return [];
  const steps = hourly ? HOUR_STEPS : DAY_STEPS;
  const step = steps.find((s) => s * slotPx >= MIN_GAP) ?? Math.ceil(MIN_GAP / slotPx);
  const picked: number[] = [];
  for (let i = n - 1; i >= 0; i -= step) picked.unshift(i);
  if (picked[0] !== 0 && picked[0] * slotPx >= MIN_GAP) picked.unshift(0);

  const lastStart = slots[n - 1].start;
  return picked.map((i, k) => {
    const t = slots[i].start;
    if (i === n - 1) {
      if (!hourly && startOfDay(now) === t) return { index: i, text: "Today" };
      if (hourly && now - t < 3_600_000 && now >= t) return { index: i, text: "Now" };
    }
    if (!hourly) return { index: i, text: dateOnly(t) };
    const midnight = new Date(t).getHours() === 0;
    const text = midnight ? dateOnly(t) : k === 0 && startOfDay(t) !== startOfDay(lastStart) ? `${dateOnly(t)} ${hourText(t)}` : hourText(t);
    return { index: i, text };
  });
}

/**
 * Date / hour axis under a row of equal-width bars (one slot per bar, in order): a small tick
 * at the centre of each labelled bar and its label centred under it, nudged inward only where
 * it would run past either end. Measures its own width, so a drawer dragged wider or expanded
 * gets more labels instead of crowded ones.
 */
export function EventAxis({ slots, hourly = false }: { slots: { start: number }[]; hourly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = slots.length;
  const ticks = axisTicks(slots, hourly, n ? w / n : 0);

  return (
    <div ref={ref} className="relative mt-0.5 h-[17px] text-[10px] leading-3 text-neutral-500" aria-hidden>
      {ticks.map(({ index, text }) => {
        const centre = ((index + 0.5) / n) * w;
        const est = text.length * CHAR_PX;
        const left = Math.min(Math.max(centre - est / 2, 0), Math.max(0, w - est));
        return (
          <span key={slots[index].start}>
            <span className="absolute top-0 h-[3px] w-px bg-neutral-300" style={{ left: centre }} />
            {/* A flex box of the estimated width: the text stays centred in it even if the estimate is a little off. */}
            <span className="absolute top-[5px] flex justify-center whitespace-nowrap" style={{ left, width: est }}>{text}</span>
          </span>
        );
      })}
    </div>
  );
}
