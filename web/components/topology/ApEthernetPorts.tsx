"use client";

import { useState } from "react";
import { cn } from "@/web/lib/utils";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName, isEthernet } from "@/web/lib/topologyFlow";
import type { Selection } from "@/web/lib/topologySelection";
import { beaconClientsLabel, classifyPortHosts, gatewayPortOf, labelPorts, looksLikeSwitch, staleLabel, staleTitle, type PortAp, type PortContext, type PortHosts } from "@/web/lib/portHosts";
import { DetailSection, JumpButton } from "./DetailParts";
import { useGatewayPorts } from "./useGatewayPorts";

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
    <div className="grid grid-cols-[2.5rem_2.5rem_3.5rem_1fr] items-center gap-2 py-1.5 text-xs" title={title}>
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

const apShortName = (a: PortAp) => a.nickname ?? `${a.model} · ${a.mac.slice(-5)}`;

/** Device cell for a gateway port: one device, one Beacon, or an inferred switch that expands. */
function PortDevice({ hosts, onSelect, open, onToggle }: {
  hosts: PortHosts;
  onSelect: (s: Selection) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { beacons, via, direct, stale } = hosts;
  if (!beacons.length && !direct.length && !via.length) {
    return stale.length ? <span className="text-neutral-400" title={staleTitle(hosts)}>{staleLabel(hosts)}</span> : null;
  }
  if (!looksLikeSwitch(hosts)) {
    if (beacons.length === 1) {
      return <JumpButton onClick={() => onSelect({ kind: "ap", id: beacons[0].mac })}>{apShortName(beacons[0])}</JumpButton>;
    }
    const d = direct[0];
    if (d?.member) return <JumpButton onClick={() => onSelect({ kind: "client", id: d.member!.id })}>{clientName(d.member)}</JumpButton>;
    if (d) return <span className="text-neutral-700">{d.hostName || d.mac}</span>;
  }
  const total = beacons.length + direct.length;
  const summary = beacons.length && direct.length
    ? `${total} devices`
    : beacons.length ? `${beacons.length} Beacons` : `${direct.length} devices`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={`Switch: ${beacons.length} Beacon(s), ${direct.length} other device(s)`}
      className="whitespace-nowrap font-medium text-blue-600 hover:underline"
    >
      Switch · {summary} {open ? "▴" : "▾"}
    </button>
  );
}

/** Expanded list under an inferred-switch row. */
function SwitchDetails({ hosts, network, onSelect }: { hosts: PortHosts; network: PortContext; onSelect: (s: Selection) => void }) {
  return (
    <div className="mb-1.5 space-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
      {hosts.beacons.map((b) => (
        <div key={b.mac} className="grid grid-cols-[1fr_auto] items-baseline gap-2">
          <span className="truncate whitespace-nowrap"><JumpButton onClick={() => onSelect({ kind: "ap", id: b.mac })}>{apShortName(b)}</JumpButton></span>
          <span className="whitespace-nowrap text-[11px] text-neutral-400" title="Clients on this Beacon, from Corteca">{beaconClientsLabel(b, network)}</span>
        </div>
      ))}
      {hosts.direct.map((d) => (
        <div key={d.mac} className="grid grid-cols-[1fr_auto] items-baseline gap-2">
          <span className="truncate whitespace-nowrap">
            {d.member
              ? <JumpButton onClick={() => onSelect({ kind: "client", id: d.member!.id })}>{clientName(d.member)}</JumpButton>
              : <span className="text-neutral-700">{d.hostName || d.mac}</span>}
          </span>
          <span className="font-mono text-[10px] text-neutral-400">{d.mac.toUpperCase()}</span>
        </div>
      ))}
      <p className="pt-0.5 text-[10px] text-neutral-400">
        Inferred: several devices share this port, so a switch or pass-through device is connected.
        {hosts.via.length > 0 && ` ${hosts.via.length} more devices reach the gateway through these Beacons.`}
      </p>
    </div>
  );
}

/** Gateway: live TR-181 Ethernet status via the REST route (fetched when the panel opens). */
function GatewayPorts({ network, ap, onSelect }: { network: McpNetwork; ap: McpAccessPoint; onSelect: (s: Selection) => void }) {
  const ports = useGatewayPorts(ap.mac, network.capturedAt);
  const [openPort, setOpenPort] = useState<number | null>(null);

  if (ports === null) {
    return (
      <p className="flex items-center gap-2 py-2 text-xs text-neutral-500">
        <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-blue-600" />
        Reading live port status…
      </p>
    );
  }
  if (ports === "error") return <ReportedPorts network={network} ap={ap} onSelect={onSelect} note="Live port status unavailable — showing wired devices reported by Corteca." />;

  return (
    <>
      {labelPorts(ports).map(({ port: p, label }) => {
        const up = p.status === "Up";
        const hosts = classifyPortHosts(p, network);
        const open = openPort === p.index;
        return (
          <div key={p.index}>
            <Row
              port={label}
              status={{ up, label: up ? "Up" : p.status === "Down" ? "Empty" : p.status }}
              rate={up && p.currentBitRate > 0 ? fmtMbps(p.currentBitRate) : undefined}
              deviceTitle={hosts.stale.length && !p.upstream ? staleTitle(hosts) : undefined}
              device={p.upstream
                ? <span className="text-neutral-600">Internet</span>
                : <PortDevice hosts={hosts} onSelect={onSelect} open={open} onToggle={() => setOpenPort(open ? null : p.index)} />}
              title={[p.name, p.maxBitRate > 0 ? `max ${fmtMbps(p.maxBitRate)}` : null, p.duplexMode || null, p.macAddress || null].filter(Boolean).join(" · ")}
            />
            {open && looksLikeSwitch(hosts) && <SwitchDetails hosts={hosts} network={network} onSelect={onSelect} />}
          </div>
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
  // Where this AP's Ethernet backhaul lands on the gateway, from the gateway's host table.
  const gatewayMac = network.aps.find((a) => a.role === "root")?.mac;
  const gatewayPorts = useGatewayPorts(uplink && isEthernet(uplink) && ap.role !== "root" ? gatewayMac : undefined, network.capturedAt);
  const landing = Array.isArray(gatewayPorts) ? gatewayPortOf(ap.mac, gatewayPorts, network) : null;
  const parentIsGateway = uplink?.parentMac === gatewayMac;
  const wired = network.members
    .filter((m) => m.connected && m.device_id === ap.mac && String(m.type ?? "").toLowerCase() === "ethernet")
    .map((m) => ({ m, port: Number((m as unknown as { port_number?: number }).port_number) || null, kbps: Number((m as unknown as { rx_statistics?: { rate?: number } }).rx_statistics?.rate) || 0 }))
    .sort((a, b) => (a.port ?? 99) - (b.port ?? 99));

  return (
    <>
      {uplink && isEthernet(uplink) && (
        <Row port="Uplink" status={{ up: true, label: "Up" }} rate={uplink.rateMbps ? fmtMbps(uplink.rateMbps) : undefined}
          device={<span className="text-neutral-600">{landing && parentIsGateway ? `Gateway ${landing.label}${landing.viaSwitch ? " (switch)" : ""}` : "Backhaul"}</span>}
          deviceTitle={landing && parentIsGateway ? `Backhaul reaches the gateway on ${landing.label}${landing.viaSwitch ? ", through a switch shared with other devices" : ""}` : undefined}
          title="Ethernet backhaul to the parent AP" />
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
      <div className="grid grid-cols-[2.5rem_2.5rem_3.5rem_1fr] gap-2 border-b border-neutral-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
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
