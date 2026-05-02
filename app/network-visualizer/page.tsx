"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { NetworkTopologyMap, type NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import { cn } from "@/web/lib/utils";
import type { Subscriber } from "@/web/lib/corteca/types";

function BackNav() {
  return (
    <div className="mb-6 flex items-center gap-4">
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

function DebugPanel({ data }: { data: NetworkTopologyData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-amber-800"
      >
        <span>Raw API response (debug)</span>
        <span>{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-amber-200 p-4 sm:grid-cols-3">
          {(["networks", "topology", "mesh"] as const).map((key) => (
            <div key={key}>
              <p className="mb-1 font-mono text-xs font-bold text-amber-700 uppercase">{key}</p>
              <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-amber-200">
                {JSON.stringify(data[key], null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NetworkVisualizerPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [topoData, setTopoData] = useState<NetworkTopologyData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscriberSelect(subscriber: Subscriber) {
    setSelected(subscriber);
    setTopoData(null);
    setError(null);

    const deviceId = subscriber.home_wifis?.[0]?.id;
    if (!deviceId) { setError("No network ID found for this subscriber."); return; }

    setFetching(true);
    try {
      const res = await fetch(`/api/network/${deviceId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTopoData(json as NetworkTopologyData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  const networkId = selected?.home_wifis?.[0]?.id;
  const online    = selected?.home_wifis?.[0]?.status?.online;
  const fullName  = selected
    ? (selected.name || `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim() || selected.email || selected.customer_id)
    : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <BackNav />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Home Network Visualizer</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Search for a subscriber to visualize their home network topology.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6">
        <SubscriberSearch
          onSelect={handleSubscriberSelect}
          selectedId={selected?.customer_id ?? selected?.uuid}
        />
      </div>

      {selected && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{fullName}</p>
            {selected.email && <p className="text-xs text-neutral-500">{selected.email}</p>}
            {networkId && <p className="mt-0.5 font-mono text-xs text-neutral-400">Network: {networkId}</p>}
          </div>
          {networkId && (
            <span className={cn("flex items-center gap-1.5 text-sm", online ? "text-green-700" : "text-neutral-400")}>
              <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} />
              {online ? "Online" : "Offline"}
            </span>
          )}
        </div>
      )}

      {fetching && (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {topoData && !fetching && (
        <div className="space-y-6">
          <NetworkTopologyMap data={topoData} />
          <DebugPanel data={topoData} />
        </div>
      )}
    </main>
  );
}
