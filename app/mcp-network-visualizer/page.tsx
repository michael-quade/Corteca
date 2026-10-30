"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/web/contexts/AuthContext";
import { McpAccessPointCards } from "@/web/components/McpAccessPointCards";
import { NetworkMembersTable } from "@/web/components/tables/NetworkMembersTable";
import { memberConnection } from "@/web/lib/memberConnection";
import { RECENT_DAYS, recentlyDisconnected } from "@/web/lib/recentlyDisconnected";
import { useMemberHistory } from "@/web/lib/useMemberHistory";
import { useModelBands } from "@/web/lib/useModelBands";
import { applyModelBands } from "@/web/lib/radioBands";
import { McpTopBar } from "@/web/components/McpTopBar";
import { McpDebugPanel } from "@/web/components/McpDebugPanel";
import { AiAnalysisCard } from "@/web/components/ai/AiAnalysisCard";
import { DeviceRenameProvider } from "@/web/components/topology/DeviceRename";
import { RecentNetworksDrawer } from "@/web/components/RecentNetworksDrawer";
import { subscriberName } from "@/web/components/SubscriberSearchBox";
import { normaliseMcpNetwork } from "@/web/lib/mcpNetwork";
import { applyDeviceNames } from "@/web/lib/deviceNames";
import { applyWifiDetails } from "@/web/lib/wifiDetails";
import { useGatewayExtras } from "@/web/lib/useGatewayExtras";
import { useAiAnalysis } from "@/web/lib/useAiAnalysis";
import { applyAiReport } from "@/web/lib/aiAnalysis";
import { applySwitches } from "@/web/lib/inferredSwitches";
import { clearRecentNetworks, forgetNetwork, loadRecentNetworks, rememberNetwork, type RecentNetwork } from "@/web/lib/recentNetworks";
import { EMPTY_FILTERS, type Selection } from "@/web/lib/topologySelection";
import { useTopologyViewState } from "@/web/lib/useTopologyViewState";
import type { Subscriber } from "@/web/lib/corteca/types";

import type { McpResponse } from "@/web/components/McpDebugPanel";

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

export default function McpNetworkVisualizerPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { view, update, ready } = useTopologyViewState();

  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [response, setResponse] = useState<McpResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recent, setRecent]     = useState<RecentNetwork[]>([]);

  useEffect(() => { setRecent(loadRecentNetworks()); }, []);

  // Names and WiFi details come from the gateway, after each MCP load.
  const { names, wifi, ports, wan, setNickname } = useGatewayExtras(response?.homeWifiId ?? null, response);
  // On-demand Corteca AI analysis / troubleshooting; findings land on the devices they mention.
  const ai = useAiAnalysis(response?.homeWifiId ?? null);
  // Bands for offline APs (they report none), by model.
  const modelBands = useModelBands();
  const network = useMemo(() => {
    if (!response) return null;
    const base = applyWifiDetails(applyModelBands(applyDeviceNames(normaliseMcpNetwork(response.payload, response.homeWifiId), names), modelBands), wifi);
    return { ...applyAiReport(applySwitches(base, ports), ai.analysis.result), wan: wan ?? undefined };
  }, [response, names, wifi, ports, wan, ai.analysis.result, modelBands]);
  // MCP lists only clients online now; Corteca's REST history fills "Recently disconnected" (in the background).
  const history = useMemberHistory(response?.homeWifiId ?? null, response);
  const disconnected = useMemo(() => ({
    label: "Recently disconnected",
    status: history.status,
    members: history.status === "ready" && network ? recentlyDisconnected(history.members, network, names) : [],
    note: `Clients seen in the last ${RECENT_DAYS} days, newest first, from Corteca's client history. The Beacons' own radios are left out, and one device seen under several randomized MACs is listed once.`,
    empty: `No clients disconnected in the last ${RECENT_DAYS} days.`,
  }), [history, network, names]);

  async function handleSubscriberSelect(subscriber: Subscriber) {
    const networkId = subscriber.home_wifis?.[0]?.id;
    if (!networkId) { setSelected(subscriber); setResponse(null); setError("No network ID found for this subscriber."); return; }
    await openNetwork(networkId, subscriber);
  }

  async function openNetwork(networkId: string, subscriber: Subscriber | null) {
    setSelected(subscriber);
    // A new network starts from a clean view; the layout choice carries over.
    update({ network: networkId, selection: null, filters: EMPTY_FILTERS, viewport: null });
    await loadNetwork(networkId);
  }

  // Remember every network that loads, with its subscriber when we know it.
  useEffect(() => {
    if (!response) return;
    const sub = selected?.home_wifis?.[0]?.id === response.homeWifiId ? selected : null;
    const gatewayModel = network?.aps.find((a) => a.role === "root")?.model;
    setRecent(rememberNetwork({ networkId: response.homeWifiId, label: sub ? subscriberName(sub) : "Shared link", subscriber: sub, gatewayModel }));
  }, [response, selected, network]);

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

  // Refresh keeps the current diagram, selection, filters and zoom on screen while
  // MCP re-reads the network; on failure the old data stays and an error shows.
  async function refreshNetwork() {
    if (!response || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/mcp/network/${encodeURIComponent(response.homeWifiId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResponse(json as McpResponse);
    } catch (e) {
      setError(`Refresh failed, showing the previous data: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }

  // Shared link: ?network=… loads straight away, without a subscriber search.
  const deepLinked = useRef(false);
  // Runs once, on the URL the page opened with; later network changes come from
  // search or Recent and must not be treated as a shared link.
  useEffect(() => {
    if (!ready || !isAuthenticated || deepLinked.current) return;
    deepLinked.current = true;
    if (!view.network) return;
    // Restore the subscriber chip if this network was opened from a search before.
    setSelected(loadRecentNetworks().find((r) => r.networkId === view.network)?.subscriber ?? null);
    void loadNetwork(view.network);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthenticated]);

  const select = useCallback((selection: Selection | null) => update({ selection }), [update]);
  // Picks from the AP cards or clients table bring the graph back into view.
  const selectAndReveal = (selection: Selection) => {
    select(selection);
    document.getElementById("topology")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
      </main>
    );
  }

  const networkId = selected?.home_wifis?.[0]?.id ?? view.network;
  const failedApis = network?.results.filter((r) => !r.ok) ?? [];

  return (
    <main className="mx-auto max-w-[2304px] px-4 py-3">
      <div className="flex gap-3">
        <RecentNetworksDrawer
          entries={recent}
          currentId={networkId}
          onPick={(r) => void (r.subscriber ? handleSubscriberSelect(r.subscriber) : openNetwork(r.networkId, null))}
          onRemove={(id) => setRecent(forgetNetwork(id))}
          onClear={() => setRecent(clearRecentNetworks())}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <McpTopBar
            subscriber={selected}
            networkId={networkId}
            capturedAt={network?.capturedAt ?? null}
            onSelectSubscriber={handleSubscriberSelect}
            onRefresh={response && !fetching ? () => void refreshNetwork() : undefined}
            refreshing={refreshing}
            onAiAnalysis={response && !fetching ? () => {
              document.getElementById("ai-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
              if (!ai.analysis.result && !ai.analysis.running) void ai.analyze();
            } : undefined}
            aiRunning={ai.analysis.running}
          />

          {!networkId && !fetching && (
            <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/70 text-center">
              <p className="text-sm font-medium text-neutral-700">Search for a subscriber above to load their home network.</p>
              <p className="text-xs text-neutral-500">Or reopen one from <span className="font-semibold">Recent</span> on the left. Data comes live from the Corteca AI MCP server.</p>
            </div>
          )}

          {fetching && (
            <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white/70">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
              <p className="text-sm text-neutral-500">Asking the Corteca AI MCP server for network data…</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
          )}

          {network && response && !fetching && (
            <DeviceRenameProvider networkId={response.homeWifiId} names={names} onRenamed={setNickname}>
            <div className="space-y-6">
              {failedApis.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                  MCP could not retrieve: {failedApis.map((r) => `${r.apiId} (HTTP ${r.status})`).join(", ")}
                </div>
              )}

              {network.aps.length > 0 ? (
                <section id="topology" className="scroll-mt-16">
                  <h2 className="sr-only">Network topology</h2>
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

              <AiAnalysisCard
                analysis={ai.analysis}
                diagnosis={ai.diagnosis}
                onAnalyze={() => void ai.analyze()}
                onTroubleshoot={(q) => void ai.troubleshoot(q)}
              />

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
                      connection={(m) => memberConnection(network, m)}
                      disconnected={disconnected}
                    />
                  )
                  : <p className="text-sm text-neutral-400">MCP returned no client data for this network.</p>}
              </section>

              <McpDebugPanel response={response} />
            </div>
            </DeviceRenameProvider>
          )}
        </div>
      </div>
    </main>
  );
}
