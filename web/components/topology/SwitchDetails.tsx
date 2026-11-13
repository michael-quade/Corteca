"use client";

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { InferredSwitch } from "@/web/lib/inferredSwitches";
import { switchUplinkLabel } from "@/web/lib/inferredSwitches";
import { clientName } from "@/web/lib/topologyFlow";
import type { Selection } from "@/web/lib/topologySelection";
import { DetailRow, DetailSection, JumpButton, apLabel, formatMbps } from "./DetailParts";

// "Ethernet · 100 Mbps": the Beacon's own link behind the switch.
const backhaulRate = (network: McpNetwork, mac: string) => {
  const l = network.backhaul.find((x) => x.childMac === mac);
  return l?.rateMbps ? `Ethernet · ${formatMbps(l.rateMbps)}` : "Beacon";
};

/** Panel for an inferred switch: where it is, what's behind it, and why we think it's there. */
export function SwitchDetails({ network, sw, onSelect }: { network: McpNetwork; sw: InferredSwitch; onSelect: (s: Selection) => void }) {
  const ap = network.aps.find((a) => a.mac === sw.apMac);
  const beacons = sw.beaconMacs.map((mac) => network.aps.find((a) => a.mac === mac)).filter((a) => !!a);
  const clients = sw.clientIds.map((id) => network.members.find((m) => m.id === id)).filter((m) => !!m);
  const count = beacons.length + clients.length;

  return (
    <>
      <DetailSection title="Inferred switch" summary="Why a switch is assumed and its uplink port">
        <DetailRow label="Connected to">
          {ap ? <JumpButton onClick={() => onSelect({ kind: "ap", id: ap.mac })}>{apLabel(ap)}</JumpButton> : sw.apMac}
        </DetailRow>
        <DetailRow label="Port">{switchUplinkLabel(sw)}</DetailRow>
        <DetailRow label="Evidence">{sw.source === "live" ? "Gateway host table (live)" : "Wired clients' port (Corteca)"}</DetailRow>
        <p className="mt-2 rounded-md bg-neutral-50 px-2 py-1.5 text-[11px] leading-relaxed text-neutral-600">
          {count} devices share {ap?.role === "root" ? "gateway" : "this AP's"} {sw.port}, so a switch, hub or pass-through device must be connected there.
          {sw.rateMbps ? ` Everything behind it shares that ${switchUplinkLabel(sw).split(" · ")[1]} port.` : ""}
          {" "}Its make, port speeds and any chained switches can't be seen.
        </p>
      </DetailSection>
      {beacons.length > 0 && (
        <DetailSection title={`Beacons (${beacons.length})`} summary={`${beacons.length} Beacon${beacons.length === 1 ? "" : "s"} behind the switch`}>
          {beacons.map((b) => (
            <DetailRow key={b.mac} label={backhaulRate(network, b.mac)}>
              <JumpButton onClick={() => onSelect({ kind: "ap", id: b.mac })}>{apLabel(b)}</JumpButton>
            </DetailRow>
          ))}
        </DetailSection>
      )}
      {clients.length > 0 && (
        <DetailSection title={`Wired clients (${clients.length})`} summary={`${clients.length} wired client${clients.length === 1 ? "" : "s"} behind the switch`}>
          {clients.map((m) => (
            <DetailRow key={m.id} label={m.ipv4 ?? "Wired"}>
              <JumpButton onClick={() => onSelect({ kind: "client", id: m.id })}>{clientName(m)}</JumpButton>
            </DetailRow>
          ))}
        </DetailSection>
      )}
      {sw.otherHosts.length > 0 && (
        <DetailSection title="Other hosts on the port" summary="Hosts the gateway lists that Corteca does not">
          {sw.otherHosts.map((h) => <DetailRow key={h.mac} label={h.mac.toUpperCase()} mono>{h.name || "Unknown"}</DetailRow>)}
          <p className="pt-1 text-[11px] text-neutral-400">Listed by the gateway but not by Corteca; possibly leftover entries.</p>
        </DetailSection>
      )}
    </>
  );
}
