"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { cn } from "@/web/lib/utils";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName, isEthernet } from "@/web/lib/topologyFlow";
import type { Selection } from "@/web/lib/topologySelection";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import { DetailSection, JumpButton } from "./DetailParts";

// Live port status per gateway MAC, kept while the page is open.
const liveCache = new Map<string, EthernetPort[] | "error">();

const normMac = (m: string) => m.toUpperCase().replace(/[:\-]/g, "");

function fmtMbps(mbps: number): string {
  return mbps >= 1000 ? `${mbps % 1000 ? (mbps / 1000).toFixed(1) : mbps / 1000} Gbps` : `${mbps} Mbps`;
}

function Row({ port, status, rate, device, deviceTitle, title }: {
  port: string;
  status?: { up: boolean; label: string };
  rate?: string;
  device?: React.ReactNode;
  /** Full device name, shown on hover when the column truncates it. */
  deviceTitle?: string;
  title?: string;
}) {
  return (
    <div className="grid grid-cols-[2.75rem_2.5rem_4.25rem_1fr] items-center gap-2 py-1.5 text-xs" title={title}>
      <span className="font-semibold text-neutral-800">{port}</span>
      {status ? (
        <span className={cn("w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold", status.up ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500")}>
          {status.label}
        </span>
      ) : <span />}
      <span className="whitespace-nowrap tabular-nums text-neutral-700">{rate ?? "—"}</span>
      <span className="min-w-0 truncate text-right" title={deviceTitle}>{device ?? <span className="text-neutral-400">—</span>}</span>
    </div>
  );
}

/** Gateway: live TR-181 Ethernet status via the REST route (fetched when the panel opens). */
function GatewayPorts({ network, ap, onSelect }: { network: McpNetwork; ap: McpAccessPoint; onSelect: (s: Selection) => void }) {
  const [ports, setPorts] = useState<EthernetPort[] | "error" | null>(liveCache.get(ap.mac) ?? null);

  useEffect(() => {
    if (liveCache.has(ap.mac)) { setPorts(liveCache.get(ap.mac)!); return; }
    let cancelled = false;
    setPorts(null);
    fetchWithAuth(`/api/network/${encodeURIComponent(ap.mac)}/ethernet`)
      .then(async (r) => {
        const body = await r.json().catch(() => null) as { ports?: EthernetPort[] } | null;
        const result = r.ok && body?.ports?.length ? body.ports : "error";
        liveCache.set(ap.mac, result);
        if (!cancelled) setPorts(result);
      })
      .catch(() => { if (!cancelled) setPorts("error"); });
    return () => { cancelled = true; };
  }, [ap.mac]);

  if (ports === null) {
    return (
      <p className="flex items-center gap-2 py-2 text-xs text-neutral-500">
        <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-blue-600" />
        Reading live port status…
      </p>
    );
  }
  if (ports === "error") return <ReportedPorts network={network} ap={ap} onSelect={onSelect} note="Live port status unavailable — showing wired devices reported by Corteca." />;

  const memberByMac = new Map(network.members.map((m) => [normMac(m.id), m]));
  let lan = 0;
  return (
    <>
      {ports.map((p) => {
        const label = p.upstream ? "WAN" : `LAN ${++lan}`;
        const host = p.connectedHost;
        const member = host?.macAddress ? memberByMac.get(normMac(host.macAddress)) : undefined;
        const name = member ? clientName(member) : host ? (host.hostName || host.macAddress) : undefined;
        const up = p.status === "Up";
        return (
          <Row
            key={p.index}
            port={label}
            status={{ up, label: up ? "Up" : p.status === "Down" ? "Empty" : p.status }}
            rate={up && p.currentBitRate > 0 ? fmtMbps(p.currentBitRate) : undefined}
            deviceTitle={name}
            device={p.upstream ? <span className="text-neutral-600">Internet</span>
              : member ? <JumpButton onClick={() => onSelect({ kind: "client", id: member.id })}>{name}</JumpButton>
              : name && <span className="text-neutral-700">{name}</span>}
            title={[p.name, p.maxBitRate > 0 ? `max ${fmtMbps(p.maxBitRate)}` : null, p.duplexMode || null, p.macAddress || null].filter(Boolean).join(" · ")}
          />
        );
      })}
      <p className="pt-1 text-[11px] text-neutral-400">Live status from the gateway (TR-181).</p>
    </>
  );
}

/**
 * Mesh APs expose no Ethernet object in their data model, so ports are built from
 * Corteca's member records (wired clients carry the port they were seen on) and
 * the mesh backhaul link. Empty ports can't be confirmed this way.
 */
function ReportedPorts({ network, ap, onSelect, note }: { network: McpNetwork; ap: McpAccessPoint; onSelect: (s: Selection) => void; note: string }) {
  const uplink = network.backhaul.find((l) => l.childMac === ap.mac);
  const wired = network.members
    .filter((m) => m.connected && m.device_id === ap.mac && String(m.type ?? "").toLowerCase() === "ethernet")
    .map((m) => ({ m, port: Number((m as unknown as { port_number?: number }).port_number) || null, kbps: Number((m as unknown as { rx_statistics?: { rate?: number } }).rx_statistics?.rate) || 0 }))
    .sort((a, b) => (a.port ?? 99) - (b.port ?? 99));

  return (
    <>
      {uplink && isEthernet(uplink) && (
        <Row port="Uplink" status={{ up: true, label: "Up" }} rate={uplink.rateMbps ? fmtMbps(uplink.rateMbps) : undefined}
          device={<span className="text-neutral-600">Backhaul</span>} title="Ethernet backhaul to the parent AP (physical port not reported)" />
      )}
      {wired.map(({ m, port, kbps }) => (
        <Row
          key={m.id}
          // Corteca numbers ports from 1 = WAN, so port 2 is the first LAN port.
          port={port ? (port === 1 ? "WAN" : `LAN ${port - 1}`) : "LAN ?"}
          status={{ up: true, label: "Up" }}
          rate={kbps > 0 ? fmtMbps(Math.round(kbps / 1000)) : undefined}
          deviceTitle={clientName(m)}
          device={<JumpButton onClick={() => onSelect({ kind: "client", id: m.id })}>{clientName(m)}</JumpButton>}
          title={`Corteca port ${port ?? "unknown"} · ${m.id}`}
        />
      ))}
      {!wired.length && !(uplink && isEthernet(uplink)) && <p className="py-1 text-xs text-neutral-500">No wired devices reported on this AP.</p>}
      <p className="pt-1 text-[11px] text-neutral-400">{note}</p>
    </>
  );
}

/** "Ethernet ports" section of the AP detail panel. */
export function ApEthernetPorts({ network, ap, onSelect }: { network: McpNetwork; ap: McpAccessPoint; onSelect: (s: Selection) => void }) {
  return (
    <DetailSection title="Ethernet ports">
      <div className="grid grid-cols-[2.75rem_2.5rem_4.25rem_1fr] gap-2 border-b border-neutral-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        <span>Port</span><span>Link</span><span>Rate</span><span className="text-right">Device</span>
      </div>
      <div className="divide-y divide-neutral-100">
        {ap.role === "root"
          ? <GatewayPorts network={network} ap={ap} onSelect={onSelect} />
          : <ReportedPorts network={network} ap={ap} onSelect={onSelect} note="Mesh APs don't report live port status (not in the TR-181 Data Elements yet). Showing wired devices Corteca has seen on this AP; other ports may be empty or unknown." />}
      </div>
    </DetailSection>
  );
}
