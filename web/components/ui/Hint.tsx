"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FloatingTip, type TipAnchor } from "./FloatingTip";

/**
 * Hover / keyboard-focus explanation under a control (shows quickly, unlike `title`). Drawn by
 * `FloatingTip` at page level, so a drawer or panel with `overflow: hidden` can't cut it off.
 * Screen readers get the text via `aria-describedby` on a hidden copy that stays in place.
 */
export function Hint({ text, children }: { text: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [anchor, setAnchor] = useState<TipAnchor | null>(null);

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }, delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => show(200)}
      onMouseLeave={hide}
      // Keyboard focus only: a mouse click shouldn't leave the tip up after the pointer leaves.
      onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) show(0); }}
      onBlur={hide}
    >
      {children(id)}
      <span id={id} className="sr-only">{text}</span>
      {anchor && (
        <FloatingTip
          anchor={anchor}
          onScrollAway={hide}
          className="w-max max-w-[240px] whitespace-pre-line rounded-md bg-neutral-900 px-2 py-1 text-[11px] leading-snug text-white shadow-lg"
        >
          {text}
        </FloatingTip>
      )}
    </span>
  );
}
