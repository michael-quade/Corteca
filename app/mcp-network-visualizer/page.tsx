"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { McpAccessPointCards } from "@/web/components/McpAccessPointCards";
import { NetworkMembersTable } from "@/web/components/tables/NetworkMembersTable";
import { McpNetworkHeader } from "@/web/components/McpNetworkHeader";
import { normaliseMcpNetwork } from "@/web/lib/mcpNetwork";
import { EMPTY_FILTERS, type Selection } from "@/web/lib/topologySelection";
import { useTopologyViewState } from "@/web/lib/useTopologyViewState";
import type { Subscriber } from "@/web/lib/corteca/types";

interface McpResponse {
  homeWifiId: string;
  query: string;
  durationMs: number;
  summary: string | null;
  payload: unknown;
}

const TopologyCanvas = dynamic(
  () => import("@/web/components/topology/TopologyCanvas").then((m) => ({ default: m.TopologyCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[560px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
      </div>
    ),
  }
);

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

function McpDebugPanel({ response }: { response: McpResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-amber-800"
      >
        <span>Raw MCP response (debug) · retrieve-network-data · {(response.durationMs / 1000).toFixed(1)}s</span>
        <span>{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-amber-200 p-4">
          <p className="font-mono text-xs text-amber-700">query: “{response.query}”</p>
          {response.summary && (
            <p className="whitespace-pre-wrap rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-amber-200">{response.summary}</p>
          )}
          <pre className="max-h-96 overflow-auto rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-amber-200">
            {JSON.stringify(response.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function McpNetworkVisualizerPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { view, update, ready } = useTopologyViewState();

  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [response, setResponse] = useState<McpResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const network = useMemo(
    () => (response ? normaliseMcpNetwork(response.payload, response.homeWifiId) : null),
    [response]
  );

  async function handleSubscriberSelect(subscriber: Subscriber) {
    setSelected(subscriber);
    const networkId = subscriber.home_wifis?.[0]?.id;
    if (!networkId) { setResponse(null); setError("No network ID found for this subscriber."); return; }
    // A new network starts from a clean view; the layout choice carries over.
    update({ network: networkId, selection: null, filters: EMPTY_FILTERS, viewport: null });
    await loadNetwork(networkId);
  }

  async function loadNetwork(networkId: string) {
    setResponse(null);
    setError(null);
    setFetching(true);
    try {
      const res = await fetchWithAuth(`/api/mcp/network/${encodeURIComponent(networkId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResponse(json as McpResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  }

  // Shared link: ?network=… loads straight away, without a subscriber search.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (!ready || !isAuthenticated || deepLinked.current || !view.network) return;
    deepLinked.current = true;
    void loadNetwork(view.network);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthenticated, view.network]);

  const select = useCallback((selection: Selection | null) => update({ selection }), [update]);
  // Picks from the AP cards or clients table bring the graph back into view.
  const selectAndReveal = (selection: Selection) => {
    select(selection);
    document.getElementById("topology")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  const networkId = selected?.home_wifis?.[0]?.id ?? view.network;
  const failedApis = network?.results.filter((r) => !r.ok) ?? [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <BackNav />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">Home Network Visualizer</h1>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">MCP</span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Search for a subscriber, then fetch live mesh and client data through the Corteca AI MCP server.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6">
        <SubscriberSearch
          onSelect={handleSubscriberSelect}
          selectedId={selected?.customer_id ?? selected?.uuid}
        />
      </div>

      {networkId && <McpNetworkHeader subscriber={selected} networkId={networkId} />}

      {fetching && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
          <p className="text-sm text-neutral-500">Asking the Corteca AI MCP server for network data…</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {network && response && !fetching && (
        <div className="space-y-8">
          {failedApis.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
              MCP could not retrieve: {failedApis.map((r) => `${r.apiId} (HTTP ${r.status})`).join(", ")}
            </div>
          )}

          {network.aps.length > 0 ? (
            <section id="topology" className="scroll-mt-4 space-y-3">
              <h2 className="text-sm font-semibold text-neutral-700">Network Topology</h2>
              <TopologyCanvas
                network={network}
                selection={view.selection}
                onSelect={select}
                filters={view.filters}
                onFiltersChange={(filters) => update({ filters })}
                layout={view.layout}
                onLayoutChange={(layout) => update({ layout })}
                initialViewport={view.viewport}
                onViewportChange={(viewport) => update({ viewport })}
              />
            </section>
          ) : (
            <p className="text-sm text-neutral-400">MCP returned no mesh data for this network.</p>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-700">Access Points ({network.aps.length})</h2>
            <McpAccessPointCards
              aps={network.aps}
              selectedMac={view.selection?.kind === "ap" ? view.selection.id : null}
              onSelect={(mac) => selectAndReveal({ kind: "ap", id: mac })}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-700">Clients ({network.members.length})</h2>
            {network.members.length > 0
              ? (
                <NetworkMembersTable
                  members={network.members}
                  selectedId={view.selection?.kind === "client" ? view.selection.id : null}
                  onSelect={(id) => selectAndReveal({ kind: "client", id })}
                />
              )
              : <p className="text-sm text-neutral-400">MCP returned no client data for this network.</p>}
          </section>

          <McpDebugPanel response={response} />
        </div>
      )}
    </main>
  );
}
