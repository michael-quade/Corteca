"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import { useEvents } from "./EventsContext";

export function EventsIcon() {
  return (
    <svg className="flex-shrink-0 text-neutral-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

/** Red "3 today" pill when something happened in the last 24 h. */
export function TodayPill() {
  const ev = useEvents();
  if (!ev?.today) return null;
  return <span className="rounded-full bg-red-50 px-1.5 text-[10px] font-medium text-red-700">{ev.today} today</span>;
}

/** Small square icon button for the drawer headers (stroke icon paths as children). */
export function IconButton({ label, onClick, children, disabled, muted }: {
  label: string; onClick: () => void; children: ReactNode; disabled?: boolean; muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-40",
        muted ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200" : "text-blue-600 hover:bg-blue-50"
      )}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
