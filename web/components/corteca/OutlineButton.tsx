"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/web/lib/utils";

/** Corteca action button: blue outline, blue text, leading icon. */
export function OutlineButton({ icon, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
