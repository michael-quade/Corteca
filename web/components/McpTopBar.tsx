"use client";

import Link from "next/link";
import { cn } from "@/web/lib/utils";
import { SubscriberSearchBox, subscriberName } from "@/web/components/SubscriberSearchBox";
import type { McpTopBarProps } from "./McpTopBar.types";

export type { McpTopBarProps };

const CONSOLE_BASE =
  process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;
}

// "2:45:38 AM (3 min ago)" — how fresh Corteca's snapshot is.
function capturedLabel(iso: string): string {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return `${d.toLocaleTimeString()} (${ago})`;
}

/** One slim row: back link, title, subscriber search, and the current network chip. */
export function McpTopBar({ subscriber, networkId, capturedAt, onSelectSubscriber, onRefresh, refreshing }: McpTopBarProps) {
  const online = subscriber?.home_wifis?.[0]?.status?.online;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
      <Link href="/dashboard" title="Back to Dashboard" aria-label="Back to Dashboard" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </Link>
      <h1 className="flex items-center gap-2 text-base font-bold text-neutral-900">
        Home Network Visualizer
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">MCP</span>
      </h1>

      <SubscriberSearchBox onSelect={onSelectSubscriber} />

      {networkId && (
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-neutral-900">
              {subscriber && <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} title={online ? "Online" : "Offline"} />}
              {subscriber ? subscriberName(subscriber) : "Shared network link"}
            </p>
            <p className="font-mono text-[11px] text-neutral-400">
              {networkId}
              {capturedAt && <span className="font-sans" title={capturedAt}> · data {capturedLabel(capturedAt)}</span>}
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title="Re-read the network from Corteca, keeping the current view"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
            >
              <svg className={cn(refreshing && "animate-spin")} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.open(consoleUrl(networkId), "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
              <path d="M8 1h3v3M11 1 6 6" />
            </svg>
            Corteca Console
          </button>
        </div>
      )}
    </div>
  );
}
