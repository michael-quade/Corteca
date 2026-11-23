"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import { useFoldedSection } from "@/web/lib/useFoldedSections";

/** Chevron pointing down when open, right when minimized. */
export function FoldChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90", className)}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * A page section whose heading minimizes it to just the heading (and `summary`, when given).
 * Minimized sections are remembered in this browser by `id`.
 */
export function FoldSection({ id, title, summary, children, className }: {
  id: string;
  title: ReactNode;
  /** Shown next to the heading while minimized. */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [folded, setFolded] = useFoldedSection(id);
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2>
          <button
            type="button"
            aria-expanded={!folded}
            onClick={() => setFolded(!folded)}
            title={folded ? "Show this section" : "Minimize this section"}
            className="flex items-center gap-1.5 rounded text-sm font-semibold text-neutral-700 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <FoldChevron open={!folded} />
            {title}
          </button>
        </h2>
        {folded && summary && <span className="text-xs text-neutral-500">{summary}</span>}
      </div>
      {!folded && children}
    </section>
  );
}
