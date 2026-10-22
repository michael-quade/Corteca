// Ethernet port data for the REST Home Network Visualizer: live ports when the
// device reports them, else capabilities from its config, else the model's spec.

import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import type { NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import type { Member } from "@/web/lib/corteca/types";
import type { PortContext } from "@/web/lib/portHosts";

export interface ApEthData {
  ports: EthernetPort[]; error?: string; notice?: string; label: string; serial: string; mac: string;
  /** "Beacon 10", from the device config. */
  model?: string;
  /** Where `ports` came from: live TR-181, the device config, or the generic model spec. */
  source?: "live" | "config" | "spec";
}

export function parseEthernetFromConfig(params: Record<string, string> | undefined): EthernetPort[] {
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

export function getModelFallbackPorts(model: string): EthernetPort[] {
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


/** Render-time fallback: with no live ports and no error, derive them from the topology configs. */
export function resolvePorts(entry: ApEthData, topoData: NetworkTopologyData): { ports: EthernetPort[]; notice?: string } {
  if (entry.ports.length > 0 || entry.error) return { ports: entry.ports, notice: entry.notice };
  const rawConfigs = (topoData.configs ?? {}) as Record<string, unknown>;
  const configEntry = rawConfigs[entry.mac];
  const cfgParams = ((configEntry as Record<string, unknown>)?.params ?? configEntry) as Record<string, string> | undefined;
  const cfgPorts = parseEthernetFromConfig(cfgParams);
  if (cfgPorts.length > 0) return { ports: cfgPorts, notice: "Port capabilities from device config — live status unavailable" };
  const rawModel = String(cfgParams?.["Device.DeviceInfo.ModelName"] ?? "");
  const model = rawModel.replace(/^nokia\s+wifi\s+/i, "").replace(/^nokia\s+/i, "").trim();
  const specPorts = getModelFallbackPorts(model);
  if (specPorts.length > 0) return { ports: specPorts, notice: `Port layout from ${model || "device"} spec — live status unavailable` };
  return { ports: [], notice: entry.notice };
}

/** Mesh APs + clients from the REST topology, for classifying hosts learned on each port. */
export function portContextFromTopology(topoData: NetworkTopologyData): PortContext {
  const mesh = (topoData.mesh ?? {}) as { aps?: Record<string, unknown>[] };
  const aps = (mesh.aps ?? []).map((a) => ({
    mac: String(a.macaddress ?? "").toUpperCase().replace(/:/g, "-"),
    role: String(a.role ?? ""),
    model: String(a.ManufacturerModel ?? a.model ?? "Beacon").replace(/^nokia\s+wifi\s+/i, ""),
    nickname: typeof a.nickname === "string" && a.nickname ? a.nickname : undefined,
  })).filter((a) => a.mac);
  const raw = topoData.members as unknown;
  const members = (Array.isArray(raw) ? raw : ((raw as { content?: unknown[] })?.content ?? [])) as Member[];
  return { aps, members };
}
