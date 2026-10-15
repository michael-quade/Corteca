"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";

function InfoIcon({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} className="inline-flex text-neutral-400 hover:text-neutral-600">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
    </span>
  );
}

/** Corteca card: white, large radius, soft shadow, bold title with optional (i) and right-side actions. */
export function CortecaCard({ title, info, actions, children, className, id }: {
  title?: ReactNode;
  info?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-neutral-200/60", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
              {title}
              {info && <InfoIcon text={info} />}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
