"use client";

import { cn } from "@/web/lib/utils";
import type { Subscriber } from "@/web/lib/corteca/types";

const CONSOLE_BASE =
  process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;
}

/** Subscriber card, or a network-only card when the page was opened from a shared link. */
export function McpNetworkHeader({ subscriber, networkId }: { subscriber: Subscriber | null; networkId: string }) {
  const online = subscriber?.home_wifis?.[0]?.status?.online;
  const fullName = subscriber
    ? (subscriber.name || `${subscriber.first_name ?? ""} ${subscriber.last_name ?? ""}`.trim() || subscriber.email || subscriber.customer_id)
    : "Shared network link";

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{fullName}</p>
        {subscriber?.email && <p className="text-xs text-neutral-500">{subscriber.email}</p>}
        <p className="mt-0.5 font-mono text-xs text-neutral-400">Network: {networkId}</p>
      </div>
      <div className="flex items-center gap-4">
        {subscriber && (
          <span className={cn("flex items-center gap-1.5 text-sm", online ? "text-green-700" : "text-neutral-400")}>
            <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} />
            {online ? "Online" : "Offline"}
          </span>
        )}
        <button
          type="button"
          onClick={() => window.open(consoleUrl(networkId), "_blank", "noopener,noreferrer")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
            <path d="M8 1h3v3M11 1 6 6"/>
          </svg>
          Launch Corteca Console
        </button>
      </div>
    </div>
  );
}
