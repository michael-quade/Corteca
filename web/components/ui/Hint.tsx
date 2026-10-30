"use client";

import { useId } from "react";

/** Hover / keyboard-focus explanation under a toolbar control (shows quickly, unlike `title`). */
export function Hint({ text, children }: { text: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-max max-w-[240px] -translate-x-1/2 whitespace-pre-line rounded-md bg-neutral-900 px-2 py-1 text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-hover:delay-200"
      >
        {text}
      </span>
    </span>
  );
}
