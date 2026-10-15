"use client";

import { useRouter } from "next/navigation";
import type { NavItem } from "@/web/lib/navItems";

/** "Other applications" picker: every page that isn't a tile on the landing page. */
export function OtherAppsSelect({ items }: { items: NavItem[] }) {
  const router = useRouter();
  return (
    <div className="relative w-full max-w-md">
      <select
        defaultValue=""
        aria-label="Other applications"
        onChange={(e) => { if (e.target.value) router.push(e.target.value); }}
        className="w-full appearance-none rounded-lg border border-neutral-300 bg-white px-3 py-2.5 pr-10 text-sm text-neutral-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      >
        <option value="" disabled>Select</option>
        {items.map((i) => (
          <option key={i.href} value={i.href}>{i.title}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
