"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { subscriberKey, subscriberName } from "@/web/lib/subscriberSearch";
import { NetworkTopologyMap, type NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import { EthernetPortPanel, type EthernetPort } from "@/web/components/EthernetPortPanel";
import { NetworkDebugPanel } from "@/web/components/NetworkDebugPanel";
import { parseEthernetFromConfig, getModelFallbackPorts, resolvePorts, portContextFromTopology, type ApEthData } from "@/web/lib/ethernetPorts";
import { meshApPorts, restNetwork } from "@/web/lib/meshApPorts";
import { beaconPortLayout, withSpecMaxRates } from "@/web/lib/portLayouts";
import { usePortLayouts } from "@/web/lib/usePortLayouts";
import { applyNamesToTopology, nicknameFor, toDeviceNames, type DeviceNames } from "@/web/lib/deviceNames";
import { PALETTE_SUBSCRIBER_KEY } from "@/web/components/CommandPalette";
import type { Subscriber } from "@/web/lib/corteca/types";
import { CortecaPage, CortecaLoading } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { Notice } from "@/web/components/corteca/Notice";

const CONSOLE_BASE =
  process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;
}

const NetworkMap = dynamic(
  () => import("@/web/components/NetworkMap").then((m) => ({ default: m.NetworkMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
      </div>
    ),
  }
);

const MESH_PORTS_NOTICE =
  "Mesh APs don't report live port status. Ports show the wired devices and Ethernet backhaul Corteca reports; a port with nothing reported may be empty or unknown.";

export default function NetworkVisualizerPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const [selected, setSelected]     = useState<Subscriber | null>(null);
  const [topoData, setTopoData]     = useState<NetworkTopologyData | null>(null);
  // User-given Beacon/client names from the gateway's device map, fetched after the topology.
  const [names, setNames]           = useState<DeviceNames | null>(null);
  const named = useMemo(() => (topoData ? applyNamesToTopology(topoData, names) : null), [topoData, names]);

  useEffect(() => {
    if (!topoData?.rootDeviceId) return;
    let cancelled = false;
    fetchWithAuth(`/api/network/${encodeURIComponent(topoData.rootDeviceId)}/device-names`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { devices?: Parameters<typeof toDeviceNames>[0] } | null;
        if (!cancelled && r.ok && body?.devices) setNames(toDeviceNames(body.devices));
      })
      .catch(() => { /* names are optional */ });
    return () => { cancelled = true; };
  }, [topoData]);
  const [apEthData, setApEthData]   = useState<Record<string, ApEthData> | null>(null);
  const [fetching, setFetching]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Mesh APs have no Ethernet object: their ports come from Corteca's members/mesh
  // reports, with switches inferred and the backhaul placed via the gateway's live ports.
  const gatewayLivePorts = useMemo(() => {
    const gw = topoData?.rootDeviceId ? apEthData?.[topoData.rootDeviceId] : undefined;
    return gw && !gw.notice && gw.ports.length ? gw.ports : null;
  }, [topoData, apEthData]);
  const meshNetwork = useMemo(() => (named ? restNetwork(named, gatewayLivePorts) : null), [named, gatewayLivePorts]);
  // Mesh Beacon port layouts per model, learned from gateways' live ports.
  const portLayouts = usePortLayouts();

  async function handleSubscriberSelect(subscriber: Subscriber) {
    setSelected(subscriber);
    setTopoData(null);
    setNames(null);
    setApEthData(null);
    setError(null);

    const deviceId = subscriber.home_wifis?.[0]?.id;
    if (!deviceId) { setError("No network ID found for this subscriber."); return; }

    setFetching(true);
    try {
      const topoRes = await fetchWithAuth(`/api/network/${deviceId}`);
      const json = await topoRes.json();
      if (!topoRes.ok) throw new Error(json.error ?? `HTTP ${topoRes.status}`);
      setTopoData(json as NetworkTopologyData);
      const allIds = Object.keys(json.configs ?? { [deviceId]: null });
      allIds.sort((a) => (a === deviceId ? -1 : 1));
      const ethResults = await Promise.all(allIds.map(async (id) => {
        const cfg = ((json.configs?.[id] as Record<string,unknown>)?.params ?? json.configs?.[id]) as Record<string,string>|undefined;
        const oui = cfg?.['Device.DeviceInfo.ManufacturerOUI'] ?? '', sn = cfg?.['Device.DeviceInfo.SerialNumber'] ?? '';
        const model = String(cfg?.['Device.DeviceInfo.ModelName'] ?? '').replace(/^nokia\s+wifi\s+/i,'').replace(/^nokia\s+/i,'').trim();
        const eid = oui && sn ? `?endpointId=${encodeURIComponent(`os::${oui}-${sn}`)}` : '';
        const r = await fetchWithAuth(`/api/network/${id}/ethernet${eid}`);
        const body = await r.json().catch(() => null);
        const label = `${id === deviceId ? 'Gateway' : 'Mesh AP'}${model ? ` — ${model}` : ''}`;
        const livePorts: EthernetPort[] = r.ok ? (body?.ports ?? []) : [];
        let ports = livePorts;
        let notice: string | undefined;
        let source: ApEthData['source'] = ports.length ? 'live' : undefined;
        if (ports.length === 0) {
          const cfgPorts = parseEthernetFromConfig(cfg);
          if (cfgPorts.length > 0) {
            ports = cfgPorts;
            source = 'config';
            notice = 'Port capabilities from device config — live status unavailable';
          } else {
            const specPorts = getModelFallbackPorts(model);
            if (specPorts.length > 0) {
              ports = specPorts;
              source = 'spec';
              notice = `Port layout from ${model} model spec — live status unavailable`;
            }
          }
        }
        const ethErr = livePorts.length === 0 && !r.ok && ports.length === 0 ? (body?.error ?? `HTTP ${r.status}`) : undefined;
        return [id, { ports, error: ethErr, notice, label, serial: sn, mac: id, model, source }] as [string, ApEthData];
      }));
      setApEthData(Object.fromEntries(ethResults));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  }

  // Deep-link from the command palette: a subscriber selected there is handed
  // off via sessionStorage since it can't travel through a URL param.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PALETTE_SUBSCRIBER_KEY);
      if (raw) sessionStorage.removeItem(PALETTE_SUBSCRIBER_KEY);
    } catch { /* sessionStorage unavailable */ }
    if (!raw) return;
    try {
      void handleSubscriberSelect(JSON.parse(raw) as Subscriber);
    } catch { /* malformed handoff — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !isAuthenticated) return <CortecaLoading />;

  const networkId = selected?.home_wifis?.[0]?.id;
  const online    = selected?.home_wifis?.[0]?.status?.online;
  const portContext = named ? portContextFromTopology(named) : undefined;
  const rootId = topoData?.rootDeviceId;
  const gatewayModel = rootId ? apEthData?.[rootId]?.model : undefined;
  const fullName  = selected
    ? subscriberName(selected)
    : null;

  return (
    <CortecaPage title="Home Network Visualizer" meta="Search for a subscriber to visualize their home network topology and location.">
      <CortecaCard title="Find a subscriber">
        <SubscriberSearch
          onSelect={handleSubscriberSelect}
          selectedKey={selected ? subscriberKey(selected) : undefined}
        />
      </CortecaCard>

      {selected && (
        <CortecaCard
          title={fullName}
          actions={networkId && (
            <>
              <StatusPill tone={online ? "good" : "neutral"}>{online ? "Online" : "Offline"}</StatusPill>
              <button
                type="button"
                onClick={() => window.open(consoleUrl(networkId), "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
                  <path d="M8 1h3v3M11 1 6 6"/>
                </svg>
                Launch Corteca Console
              </button>
            </>
          )}
        >
          <div className="-mt-3 space-y-0.5">
            {selected.email && <p className="text-sm text-neutral-500">{selected.email}</p>}
            {networkId && <p className="font-mono text-xs text-neutral-400">Network: {networkId}</p>}
          </div>
        </CortecaCard>
      )}

      {fetching && (
        <div className="flex items-center justify-center rounded-2xl bg-white py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
        </div>
      )}

      {error && <Notice tone="error" title="Couldn't load the network">{error}</Notice>}

      {topoData && !fetching && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <CortecaCard title="Network topology"><NetworkTopologyMap data={named ?? topoData} /></CortecaCard>
            <CortecaCard title="Network location"><NetworkMap data={named ?? topoData} /></CortecaCard>
          </div>
          {apEthData && Object.values(apEthData).map((entry) => {
            const resolved = resolvePorts(entry, topoData);
            const mesh = entry.mac !== rootId && meshNetwork;
            // A mesh Beacon's config rarely lists its ports: use its model's learned layout.
            const layout = mesh && entry.source !== "config"
              ? beaconPortLayout(entry.model ?? "", portLayouts, gatewayModel && gatewayLivePorts ? { model: gatewayModel, ports: gatewayLivePorts } : null)
              : null;
            const ports = mesh ? meshApPorts(meshNetwork, entry.mac, layout?.ports.length ? layout.ports : resolved.ports, gatewayLivePorts) : withSpecMaxRates(entry.model ?? "", resolved.ports);
            const notice = mesh ? `${MESH_PORTS_NOTICE}${layout?.note ? ` ${layout.note}` : ""}` : resolved.notice;
            return (
              <CortecaCard
                key={entry.mac}
                title={nicknameFor(names, entry.mac) ? `${nicknameFor(names, entry.mac)} · ${entry.label} — Ethernet ports` : `${entry.label} — Ethernet ports`}
              >
                <p className="-mt-3 mb-3 font-mono text-xs text-neutral-400">{entry.serial ? `S/N: ${entry.serial} · ` : ""}MAC: {entry.mac}</p>
                {notice && <p className="mb-2 text-xs italic text-neutral-500">{notice}</p>}
                {!mesh && entry.error && <p className="text-sm text-red-600">{entry.error}</p>}
                {!entry.error && ports.length === 0 && <p className="text-sm text-neutral-500">No Ethernet data returned.</p>}
                {ports.length > 0 && <EthernetPortPanel ports={ports} context={portContext} />}
              </CortecaCard>
            );
          })}
          <NetworkDebugPanel data={topoData} />
        </>
      )}
    </CortecaPage>
  );
}
