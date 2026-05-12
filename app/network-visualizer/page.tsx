"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { NetworkTopologyMap, type NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import { EthernetPortPanel, type EthernetPort } from "@/web/components/EthernetPortPanel";
import { cn } from "@/web/lib/utils";
import type { Subscriber } from "@/web/lib/corteca/types";

const NetworkMap = dynamic(
  () => import("@/web/components/NetworkMap").then((m) => ({ default: m.NetworkMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
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
          {(["networks", "topology", "mesh", "members"] as const).map((key) => (
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

interface ApEthData { ports: EthernetPort[]; error?: string; notice?: string; label: string; serial: string; mac: string }

function parseEthernetFromConfig(params: Record<string, string> | undefined): EthernetPort[] {
  if (!params) return [];
  const grouped: Record<string, Record<string, string>> = {};
  for (const [key, val] of Object.entries(params)) {
    const m = key.match(/^Device\.Ethernet\.Interface\.(\d+)\.(.*)/);
    if (m) {
      if (!grouped[m[1]]) grouped[m[1]] = {};
      grouped[m[1]][m[2]] = val;
    }
  }
  if (Object.keys(grouped).length === 0) return [];
  return Object.entries(grouped)
    .map(([idx, p]) => ({
      index: parseInt(idx, 10),
      name: p.Name ?? `eth${parseInt(idx, 10) - 1}`,
      upstream: p.Upstream === 'true',
      enable: p.Enable !== 'false',
      status: (p.Status ?? 'Unknown') as EthernetPort['status'],
      maxBitRate: parseInt(p.MaxBitRate ?? '-1', 10),
      currentBitRate: parseInt(p.CurrentBitRate ?? '0', 10),
      duplexMode: p.DuplexMode ?? '',
      macAddress: p.MACAddress ?? '',
      connectedHost: null,
    }))
    .sort((a, b) => (a.upstream !== b.upstream ? (a.upstream ? -1 : 1) : a.index - b.index));
}

function getModelFallbackPorts(model: string): EthernetPort[] {
  if (model.toLowerCase().includes('beacon')) {
    return [
      { index: 1, name: 'eth0', upstream: true,  enable: true, status: 'Unknown', maxBitRate: 10000, currentBitRate: 0, duplexMode: '', macAddress: '', connectedHost: null },
      { index: 2, name: 'eth1', upstream: false, enable: true, status: 'Unknown', maxBitRate: -1,    currentBitRate: 0, duplexMode: '', macAddress: '', connectedHost: null },
      { index: 3, name: 'eth2', upstream: false, enable: true, status: 'Unknown', maxBitRate: -1,    currentBitRate: 0, duplexMode: '', macAddress: '', connectedHost: null },
      { index: 4, name: 'eth3', upstream: false, enable: true, status: 'Unknown', maxBitRate: -1,    currentBitRate: 0, duplexMode: '', macAddress: '', connectedHost: null },
    ];
  }
  return [];
}

export default function NetworkVisualizerPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const [selected, setSelected]     = useState<Subscriber | null>(null);
  const [topoData, setTopoData]     = useState<NetworkTopologyData | null>(null);
  const [apEthData, setApEthData]   = useState<Record<string, ApEthData> | null>(null);
  const [fetching, setFetching]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubscriberSelect(subscriber: Subscriber) {
    setSelected(subscriber);
    setTopoData(null);
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
        if (ports.length === 0) {
          const cfgPorts = parseEthernetFromConfig(cfg);
          if (cfgPorts.length > 0) {
            ports = cfgPorts;
            notice = 'Port capabilities from device config — live status unavailable';
          } else {
            const specPorts = getModelFallbackPorts(model);
            if (specPorts.length > 0) {
              ports = specPorts;
              notice = `Port layout from ${model} model spec — live status unavailable`;
            }
          }
        }
        const ethErr = livePorts.length === 0 && !r.ok && ports.length === 0 ? (body?.error ?? `HTTP ${r.status}`) : undefined;
        return [id, { ports, error: ethErr, notice, label, serial: sn, mac: id }] as [string, ApEthData];
      }));
      setApEthData(Object.fromEntries(ethResults));
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
    <main className="mx-auto max-w-7xl px-6 py-10">
      <BackNav />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Home Network Visualizer</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Search for a subscriber to visualize their home network topology and location.
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
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-700">Network Topology</h2>
              <NetworkTopologyMap data={topoData} />
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-700">Network Location</h2>
              <NetworkMap data={topoData} />
            </div>
          </div>
          {apEthData && Object.entries(apEthData).map(([, entry]) => {
            const { error: ethErr, label, serial, mac } = entry;
            let ports = entry.ports;
            let notice = entry.notice;

            // Render-time fallback: if no live ports and no error, derive from topoData.configs
            if (ports.length === 0 && !ethErr) {
              const rawConfigs = (topoData?.configs ?? {}) as Record<string, unknown>;
              const configEntry = rawConfigs[mac];
              const cfgParams = ((configEntry as Record<string, unknown>)?.params ?? configEntry) as Record<string, string> | undefined;
              const cfgPorts = parseEthernetFromConfig(cfgParams);
              if (cfgPorts.length > 0) {
                ports = cfgPorts;
                notice = 'Port capabilities from device config — live status unavailable';
              } else {
                const rawModel = String(cfgParams?.['Device.DeviceInfo.ModelName'] ?? '');
                const model = rawModel.replace(/^nokia\s+wifi\s+/i, '').replace(/^nokia\s+/i, '').trim();
                const specPorts = getModelFallbackPorts(model);
                if (specPorts.length > 0) {
                  ports = specPorts;
                  notice = `Port layout from ${model || 'device'} spec — live status unavailable`;
                }
              }
            }

            return (
              <div key={mac} className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-700">{label} — Ethernet Ports</h2>
                  <p className="font-mono text-xs text-neutral-400">{serial ? `S/N: ${serial} · ` : ''}MAC: {mac}</p>
                </div>
                {ethErr && <p className="text-sm text-red-600">{ethErr}</p>}
                {notice && <p className="text-xs text-neutral-400 italic">{notice}</p>}
                {!ethErr && ports.length === 0 && <p className="text-sm text-neutral-400">No Ethernet data returned.</p>}
                {ports.length > 0 && <EthernetPortPanel ports={ports} />}
              </div>
            );
          })}
          <DebugPanel data={topoData} />
        </div>
      )}
    </main>
  );
}
