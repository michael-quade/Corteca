"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { McpAccessPointCards } from "@/web/components/McpAccessPointCards";
import { NetworkMembersTable } from "@/web/components/tables/NetworkMembersTable";
import { memberConnection } from "@/web/lib/memberConnection";
import { RECENT_DAYS, recentlyDisconnected } from "@/web/lib/recentlyDisconnected";
import { useMemberHistory } from "@/web/lib/useMemberHistory";
import { useModelBands } from "@/web/lib/useModelBands";
import { applyModelBands } from "@/web/lib/radioBands";
import { McpDebugPanel, type McpResponse } from "@/web/components/McpDebugPanel";
import { AiAnalysisCard } from "@/web/components/ai/AiAnalysisCard";
import { DeviceRenameProvider } from "@/web/components/topology/DeviceRename";
import { subscriberName } from "@/web/components/SubscriberSearchBox";
import { normaliseMcpNetwork } from "@/web/lib/mcpNetwork";
import { applyDeviceNames } from "@/web/lib/deviceNames";
import { applyWifiDetails } from "@/web/lib/wifiDetails";
import { useGatewayExtras } from "@/web/lib/useGatewayExtras";
import { useAiAnalysis } from "@/web/lib/useAiAnalysis";
import { applyAiReport } from "@/web/lib/aiAnalysis";
import { applySwitches } from "@/web/lib/inferredSwitches";
import { rememberNetwork } from "@/web/lib/recentNetworks";
import type { Selection } from "@/web/lib/topologySelection";
import { useTopologyViewState } from "@/web/lib/useTopologyViewState";
import { EventsContext, useEventsController } from "@/web/components/events/EventsContext";
import { TdsEventsContext, useTdsEventsController } from "@/web/components/tds-events/TdsEventsContext";
import { cn } from "@/web/lib/utils";
import type { NetworkWorkspaceProps } from "./NetworkWorkspace.types";

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

async function readNetwork(networkId: string): Promise<McpResponse> {
  const res = await fetchWithAuth(`/api/mcp/network/${encodeURIComponent(networkId)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as McpResponse;
}

/**
 * Everything for one open network: its MCP data, Refresh, gateway reads, AI analysis
 * and view. The page keeps one mounted per tab and hides the others, so switching
 * tabs never re-asks MCP and AI runs carry on in the background. A tab restored after
 * a reload loads the first time it is shown.
 */
export function NetworkWorkspace({ networkId, subscriber, initialView, active, onStatus, onRecentChange, actions }: NetworkWorkspaceProps) {
  const { view, update } = useTopologyViewState(initialView, active);
  const [response, setResponse] = useState<McpResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The canvas measures itself when it mounts, so it waits until the tab is on screen.
  const [shown, setShown] = useState(false);
  const topologyRef = useRef<HTMLElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  // Names and WiFi details come from the gateway, after each MCP load.
  const { names, wifi, ports, wan, setNickname } = useGatewayExtras(response?.homeWifiId ?? null, response);
  // On-demand Corteca AI analysis / troubleshooting; findings land on the devices they mention.
  const ai = useAiAnalysis(networkId);
  // Bands for offline APs (they report none), by model.
  const modelBands = useModelBands();
  const network = useMemo(() => {
    if (!response) return null;
    const base = applyWifiDetails(applyModelBands(applyDeviceNames(normaliseMcpNetwork(response.payload, response.homeWifiId), names), modelBands), wifi);
    return { ...applyAiReport(applySwitches(base, ports), ai.analysis.result), wan: wan ?? undefined };
  }, [response, names, wifi, ports, wan, ai.analysis.result, modelBands]);
  // MCP lists only clients online now; Corteca's REST history fills "Recently disconnected" (in the background).
  const history = useMemberHistory(response?.homeWifiId ?? null, response);
  // Corteca's activity log (events drawer, AP / client panels, diagram badges), read in the background.
  // Clients in it that aren't online now are named from the gateway's device map and the history.
  const historyMembers = history.status === "ready" ? history.members : null;
  const offlineNames = useMemo(() => ({ deviceNames: names, history: historyMembers }), [names, historyMembers]);
  const events = useEventsController(networkId, response?.homeWifiId ?? null, network, offlineNames);
  // TDS Network Events RCR: the same log with P1–P4 severity, its own popout.
  const tdsEvents = useTdsEventsController(events);
  const disconnected = useMemo(() => ({
    label: "Recently disconnected",
    status: history.status,
    members: history.status === "ready" && network ? recentlyDisconnected(history.members, network, names) : [],
    note: `Clients seen in the last ${RECENT_DAYS} days, newest first, from Corteca's client history. The Beacons' own radios are left out, and one device seen under several randomized MACs is listed once.`,
    empty: `No clients disconnected in the last ${RECENT_DAYS} days.`,
  }), [history, network, names]);

  const load = useCallback(async () => {
    setResponse(null);
    setError(null);
    setFetching(true);
    try { setResponse(await readNetwork(networkId)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setFetching(false); }
  }, [networkId]);

  // A tab loads the first time it is on screen (restored background tabs wait until picked).
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    void load();
  }, [active, load]);

  useEffect(() => { if (active && response) setShown(true); }, [active, response]);

  // Refresh keeps the current diagram, selection, filters and zoom on screen while
  // MCP re-reads the network; on failure the old data stays and an error shows.
  const refresh = useCallback(async () => {
    if (!response || refreshing) return;
    setRefreshing(true);
    setError(null);
    try { setResponse(await readNetwork(networkId)); }
    catch (e) { setError(`Refresh failed, showing the previous data: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setRefreshing(false); }
  }, [networkId, response, refreshing]);

  const aiAnalysis = useCallback(() => {
    aiRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!ai.analysis.result && !ai.analysis.running) void ai.analyze();
  }, [ai]);

  const { setDrawer } = events;
  const openEvents = useCallback(() => {
    setDrawer("open");
    topologyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setDrawer]);

  useEffect(() => {
    actions.current[networkId] = { refresh: () => void refresh(), aiAnalysis, events: openEvents };
  }, [actions, networkId, refresh, aiAnalysis, openEvents]);
  useEffect(() => () => { delete actions.current[networkId]; }, [actions, networkId]);

  // Remember every network that loads, with its subscriber when we know it.
  const gatewayModel = network?.aps.find((a) => a.role === "root")?.model;
  useEffect(() => {
    if (!response) return;
    onRecentChange(rememberNetwork({ networkId, label: subscriber ? subscriberName(subscriber) : "Shared link", subscriber, gatewayModel }));
  }, [response, subscriber, gatewayModel, networkId, onRecentChange]);

  const aiRunning = ai.analysis.running || ai.diagnosis.running;
  useEffect(() => {
    onStatus(networkId, {
      loaded: !!response, loading: fetching, refreshing, aiRunning, error: !!error,
      capturedAt: network?.capturedAt ?? null, gatewayModel, layout: view.layout, eventsToday: events.today,
    });
  }, [networkId, onStatus, response, fetching, refreshing, aiRunning, error, network?.capturedAt, gatewayModel, view.layout, events.today]);

  const select = useCallback((selection: Selection | null) => update({ selection }), [update]);
  // Picks from the AP cards or clients table bring the graph back into view.
  const selectAndReveal = (selection: Selection) => {
    select(selection);
    topologyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const failedApis = network?.results.filter((r) => !r.ok) ?? [];

  return (
    <div className={cn("space-y-3", !active && "hidden")}>
      {fetching && (
        <div className="flex h-[calc(100vh-11.5rem)] min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white/70">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
          <p className="text-sm text-neutral-500">Asking the Corteca AI MCP server for network data…</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <span>{error}</span>
          {!response && !fetching && (
            <button type="button" onClick={() => void load()} className="flex-shrink-0 rounded-lg border border-blue-600 bg-white px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-50">
              Try again
            </button>
          )}
        </div>
      )}

      {network && response && !fetching && shown && (
        <DeviceRenameProvider networkId={response.homeWifiId} names={names} onRenamed={setNickname}>
        <div className="space-y-6">
          {failedApis.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
              MCP could not retrieve: {failedApis.map((r) => `${r.apiId} (HTTP ${r.status})`).join(", ")}
            </div>
          )}

          {network.aps.length > 0 ? (
            <section ref={topologyRef} className="scroll-mt-16">
              <h2 className="sr-only">Network topology</h2>
              <EventsContext.Provider value={events}>
              <TdsEventsContext.Provider value={tdsEvents}>
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
              </TdsEventsContext.Provider>
              </EventsContext.Provider>
            </section>
          ) : (
            <p className="text-sm text-neutral-400">MCP returned no mesh data for this network.</p>
          )}

          <div ref={aiRef}>
            <AiAnalysisCard
              analysis={ai.analysis}
              diagnosis={ai.diagnosis}
              onAnalyze={() => void ai.analyze()}
              onTroubleshoot={(q) => void ai.troubleshoot(q)}
            />
          </div>

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
  );
}
