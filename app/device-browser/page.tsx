"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { DataModelBrowser } from "@/web/components/DataModelBrowser";
import { cn } from "@/web/lib/utils";
import type { Subscriber } from "@/web/lib/corteca/types";

function BackNav() {
  return (
    <div className="mb-6">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function DeviceBrowserPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selected, setSelected] = useState<Subscriber | null>(null);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  const deviceId  = selected?.home_wifis?.[0]?.id;
  const online    = selected?.home_wifis?.[0]?.status?.online;
  const fullName  = selected
    ? (selected.name || `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim() || selected.email || selected.customer_id)
    : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <BackNav />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Device Data Model Browser</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Explore and configure the full USP data model for any managed device.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-6">
        <SubscriberSearch onSelect={setSelected} selectedId={selected?.customer_id ?? selected?.uuid} />
      </div>

      {selected && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{fullName}</p>
            {selected.email && <p className="text-xs text-neutral-500">{selected.email}</p>}
            {deviceId && <p className="mt-0.5 font-mono text-xs text-neutral-400">Device ID: {deviceId}</p>}
          </div>
          {deviceId && (
            <span className={cn("flex items-center gap-1.5 text-sm", online ? "text-green-700" : "text-neutral-400")}>
              <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} />
              {online ? "Online" : "Offline"}
            </span>
          )}
        </div>
      )}

      {deviceId ? (
        <DataModelBrowser deviceId={deviceId} />
      ) : selected ? (
        <p className="text-sm text-neutral-400">No device ID found for this subscriber.</p>
      ) : null}
    </main>
  );
}
