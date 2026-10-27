"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";

export function OpenBadge() {
  return (
    <span aria-hidden className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7" />
        <path d="M7.5 2H10v2.5M10 2 5.5 6.5" />
      </svg>
    </span>
  );
}

/** Wide landing-page tile in the style of the Corteca console home. */
export function LandingCard({ title, description, icon, href, className }: { title: string; description: string; icon: ReactNode; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group flex items-center gap-5 rounded-2xl bg-white px-6 py-6 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-neutral-200/70 transition-all hover:shadow-md hover:ring-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", className)}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-blue-600 [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-medium text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">{description}</span>
      </span>
      <OpenBadge />
    </Link>
  );
}
