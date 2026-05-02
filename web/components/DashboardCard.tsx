"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
}

export function DashboardCard({ title, description, icon, href }: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors group-hover:bg-neutral-200">
        {icon}
      </div>

      <div className="flex-1">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
      </div>

      <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition-colors group-hover:text-neutral-900">
        Launch
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:translate-x-0.5"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </span>
    </Link>
  );
}
