"use client";

import { useState } from "react";
import { cn } from "@/web/lib/utils";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName } from "@/web/lib/topologyFlow";
import type { Selection } from "@/web/lib/topologySelection";
import { beaconClientsLabel, classifyPortHosts, labelPorts, looksLikeSwitch, staleLabel, staleTitle, type PortAp, type PortContext, type PortHosts } from "@/web/lib/portHosts";
import { DetailSection, JumpButton } from "./DetailParts";
import { useGatewayPorts } from "./useGatewayPorts";
import { formatRate } from "@/web/lib/rateFormat";
import { meshApPorts } from "@/web/lib/meshApPorts";
import { beaconPortLayout } from "@/web/lib/portLayouts";
import { usePortLayouts } from "@/web/lib/usePortLayouts";

const fmtMbps = (mbps: number) => formatRate(mbps);

function Row({ port, status, rate, device, deviceTitle, title, wide }: {
  port: string;
  status?: { up: boolean; label: string };
  rate?: string;
  device?: React.ReactNode;
  /** Full device name, shown on hover when the column truncates it. */
  deviceTitle?: string;
  title?: string;
  /** No link/rate: the device cell spans those columns too (long labels like "Wireless backhaul · 6 GHz"). */
  wide?: boolean;
}) {
  if (wide) {
    return (
      <div className="grid grid-cols-[2.5rem_2.5rem_3.5rem_1fr] items-center gap-2 py-1.5 text-xs" title={title}>
        <span className="font-semibold text-neutral-800">{port}</span>
        <span className="col-span-3 min-w-0 truncate text-right" title={deviceTitle}>{device}</span>
      </div>
    );
  }
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
    const d = direct.find((x) => x.member) ?? direct[0];
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
 * Mesh APs expose no Ethernet object in their data model, so every port of the
 * model's layout (learned from a gateway of that model, see portLayouts.ts) is
 * filled from Corteca's reports: wired clients' port numbers, switches inferred
 * from several clients on one port, and the Ethernet backhaul. A port with nothing
 * reported may be empty or unknown.
 */
function ReportedPorts({ network, ap, onSelect, note }: { network: McpNetwork; ap: McpAccessPoint; onSelect: (s: Selection) => void; note: string }) {
  const gateway = network.aps.find((a) => a.role === "root");
  // The gateway's live ports place the backhaul and, for the same model, give the layout.
  const gatewayPorts = useGatewayPorts(ap.role !== "root" ? gateway?.mac : undefined, network.capturedAt);
  const live = Array.isArray(gatewayPorts) ? gatewayPorts : null;
  const layouts = usePortLayouts();
  const layout = beaconPortLayout(ap.model, layouts, gateway && live ? { model: gateway.model, ports: live } : null);
  const ports = meshApPorts(network, ap.mac, layout.ports, live);

  return (
    <>
      {ports.map((p) => {
        const r = p.reported;
        if (!r) return null;
        const label = r.portLabel === "WAN" ? "WAN" : `LAN ${r.portLabel}`;
        const rate = p.currentBitRate > 0 ? fmtMbps(p.currentBitRate) : undefined;
        if (r.kind === "none") {
          return <Row key={p.index} port={label} device={<span className="text-neutral-400">Nothing reported</span>} title={`${p.name} · may be empty or unknown`} />;
        }
        if (r.kind === "wireless") {
          return (
            <Row key={p.index} port={label} wide
              device={<JumpButton onClick={() => onSelect({ kind: "link", id: ap.mac })}>Wireless backhaul{r.uplink ? ` · ${r.uplink}` : ""}</JumpButton>}
              title="The backhaul to the parent AP is WiFi; nothing wired is reported on this port" />
          );
        }
        if (r.kind === "uplink") {
          return (
            <Row key={p.index} port={label} status={{ up: true, label: "Up" }} rate={rate}
              device={<JumpButton onClick={() => onSelect({ kind: "link", id: ap.mac })}>{r.uplink}</JumpButton>}
              deviceTitle={`Ethernet backhaul to ${r.uplink}`} title="Ethernet backhaul to the parent AP" />
          );
        }
        if (r.kind === "switch" && r.switch) {
          const sw = r.switch;
          return (
            <Row key={p.index} port={label} status={{ up: true, label: "Up" }} rate={rate}
              device={<JumpButton onClick={() => onSelect({ kind: "switch", id: sw.id })}>Switch · {r.devices.length} devices</JumpButton>}
              deviceTitle={r.devices.map((d) => d.name).join(", ")}
              title="Inferred: Corteca reports several wired devices on this port; the rate is the port↔switch link" />
          );
        }
        const d = r.devices[0];
        return (
          <Row key={p.index} port={label} status={{ up: true, label: "Up" }} rate={rate}
            device={<JumpButton onClick={() => onSelect({ kind: "client", id: d.mac })}>{d.name}</JumpButton>}
            deviceTitle={d.name} title={`Corteca port ${r.portLabel} · ${d.mac}`} />
        );
      })}
      {!ports.length && <p className="py-1 text-xs text-neutral-500">No wired devices reported on this AP.</p>}
      <p className="pt-1 text-[11px] text-neutral-400">{note}{layout.note && ` ${layout.note}`}</p>
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
          : <ReportedPorts network={network} ap={ap} onSelect={onSelect} note="Mesh APs don't report live port status (not in the TR-181 Data Elements yet). Ports show the wired devices and Ethernet backhaul Corteca reports." />}
      </div>
    </DetailSection>
  );
}
