"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";

/** Corteca-style notice card (light blue info / light red error) with an icon and optional close. */
export function Notice({ tone = "info", title, children, onClose }: {
  tone?: "info" | "error";
  title: string;
  children?: ReactNode;
  onClose?: () => void;
}) {
  const error = tone === "error";
  return (
    <div role={error ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-2xl px-5 py-4", error ? "bg-red-50" : "bg-blue-50")}>
      <span className={cn("mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", error ? "bg-red-600" : "bg-blue-600")}>
        {error ? "!" : "i"}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", error ? "text-red-700" : "text-blue-700")}>{title}</p>
        {children && <div className={cn("mt-0.5 text-sm", error ? "text-red-600" : "text-blue-700")}>{children}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded p-1 text-neutral-500 hover:bg-white/60 hover:text-neutral-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
