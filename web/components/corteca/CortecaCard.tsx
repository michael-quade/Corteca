"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import { CARD } from "@/web/components/corteca/styles";
import { FoldChevron } from "@/web/components/ui/FoldSection";

function InfoIcon({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} className="inline-flex text-neutral-400 hover:text-neutral-600">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
    </span>
  );
}

/**
 * Corteca card: white, large radius, soft shadow, bold title with optional (i) and right-side actions.
 * With `onToggleFold` the title gets a chevron and minimizes the card to its header (+ `summary`).
 */
export function CortecaCard({ title, info, actions, children, className, id, folded, onToggleFold, summary }: {
  title?: ReactNode;
  info?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  folded?: boolean;
  onToggleFold?: () => void;
  /** Shown beside the title while minimized. */
  summary?: ReactNode;
}) {
  const heading = onToggleFold ? (
    <button
      type="button"
      aria-expanded={!folded}
      onClick={onToggleFold}
      title={folded ? "Show this section" : "Minimize this section"}
      className="flex items-center gap-1.5 rounded hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <FoldChevron open={!folded} className="h-5 w-5" />
      {title}
    </button>
  ) : title;
  return (
    <section id={id} className={cn(CARD, "p-5", className)}>
      {(title || actions) && (
        <div className={cn("flex flex-wrap items-center justify-between gap-3", !folded && "mb-4")}>
          {title && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                {heading}
                {info && <InfoIcon text={info} />}
              </h2>
              {folded && summary && <span className="text-xs text-neutral-500">{summary}</span>}
            </div>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {!folded && children}
    </section>
  );
}
