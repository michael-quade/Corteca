"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";

/**
 * Corteca-console page shell: plain light grey ground (covers the global
 * background image), a breadcrumb title ("Dashboards / <title>"), an optional
 * meta line and right-aligned actions, then the page's cards.
 */
export function CortecaPage({ title, crumbs, meta, actions, children, width = "max-w-[1400px]", className }: {
  title: ReactNode;
  /** Extra crumbs between "Dashboards" and the title, e.g. [{ label: "Performance Reports", href: "/reports" }]. */
  crumbs?: { label: string; href: string }[];
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
  className?: string;
}) {
  const trail = [{ label: "Dashboards", href: "/dashboard" }, ...(crumbs ?? [])];
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa]">
      <main className={cn("mx-auto space-y-6 px-6 py-8", width, className)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-2 text-xl font-semibold text-neutral-900">
              {trail.map((c) => (
                <span key={c.href} className="flex items-baseline gap-2">
                  <Link href={c.href} className="text-neutral-500 transition-colors hover:text-blue-600">{c.label}</Link>
                  <span className="text-neutral-400">/</span>
                </span>
              ))}
              <span>{title}</span>
            </h1>
            {meta && <div className="mt-1 text-xs text-neutral-500">{meta}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

/** Centered spinner on the Corteca ground, for auth/loading states. */
export function CortecaLoading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 bg-[#f5f7fa]">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
      {label && <p className="text-sm text-neutral-500">{label}</p>}
    </div>
  );
}
