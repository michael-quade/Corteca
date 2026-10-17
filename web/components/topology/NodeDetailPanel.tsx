"use client";

import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { SLOW_ETHERNET_MBPS, clientName, isEthernet } from "@/web/lib/topologyFlow";
import { formatBytes, topTalkers } from "@/web/lib/clientInsights";
import type { Selection } from "@/web/lib/topologySelection";
import { ClientDetails } from "./ClientDetails";
import { ApEthernetPorts } from "./ApEthernetPorts";
import { DetailRow, DetailSection, JumpButton, apLabel, formatDate, formatMbps } from "./DetailParts";

type Select = (sel: Selection) => void;

function LinkSummary({ link, onSelect }: { link: McpBackhaulLink; onSelect: Select }) {
  const eth = isEthernet(link);
  return (
    <JumpButton onClick={() => onSelect({ kind: "link", id: link.childMac })}>
      {eth ? "Ethernet" : `WiFi${link.quality ? ` · ${link.quality}` : ""}`}
      {link.rateMbps ? ` · ${formatMbps(link.rateMbps)}` : ""}
    </JumpButton>
  );
}

function ApDetails({ network, ap, onSelect }: { network: McpNetwork; ap: McpAccessPoint; onSelect: Select }) {
  const uplink = network.backhaul.find((l) => l.childMac === ap.mac);
  const parent = uplink && network.aps.find((a) => a.mac === uplink.parentMac);
  const children = network.backhaul.filter((l) => l.parentMac === ap.mac);
  const talkers = topTalkers(network, ap.mac);

  return (
    <>
      <DetailSection title="Access point">
        <DetailRow label="Status">{ap.online ? "Online" : "Offline"}</DetailRow>
        <DetailRow label="Clients">{ap.clientCount}</DetailRow>
        <DetailRow label="MAC" mono>{ap.mac}</DetailRow>
        <DetailRow label="Serial" mono>{ap.serial}</DetailRow>
        <DetailRow label="Firmware" mono>{ap.firmware}</DetailRow>
        <DetailRow label="Hardware" mono>{ap.hardwareVersion}</DetailRow>
        <DetailRow label="LAN IP" mono>{ap.ipAddress}</DetailRow>
        <DetailRow label="Public IP" mono>{ap.wanIp}</DetailRow>
        <DetailRow label="Last boot">{formatDate(ap.lastBoot)}</DetailRow>
        <DetailRow label="Last offline">{formatDate(ap.lastOffline)}</DetailRow>
      </DetailSection>
      {talkers.length > 0 && (
        <DetailSection title="Top clients by traffic">
          {talkers.map(({ member, total }) => (
            <DetailRow key={member.id} label={formatBytes(total)}>
              <JumpButton onClick={() => onSelect({ kind: "client", id: member.id })}>{clientName(member)}</JumpButton>
            </DetailRow>
          ))}
        </DetailSection>
      )}
      <ApEthernetPorts network={network} ap={ap} onSelect={onSelect} />
      <DetailSection title="Radios">
        <DetailRow label="Bands">{ap.bands.join(" · ")}</DetailRow>
        <DetailRow label="SSIDs">{ap.ssids.join(", ")}</DetailRow>
      </DetailSection>
      <DetailSection title="Mesh">
        {parent && uplink ? (
          <>
            <DetailRow label="Uplink to">
              <JumpButton onClick={() => onSelect({ kind: "ap", id: parent.mac })}>{apLabel(parent)}</JumpButton>
            </DetailRow>
            <DetailRow label="Backhaul"><LinkSummary link={uplink} onSelect={onSelect} /></DetailRow>
          </>
        ) : (
          <DetailRow label="Uplink">{ap.role === "root" ? "Internet (gateway)" : "Unknown"}</DetailRow>
        )}
        {children.map((l) => {
          const child = network.aps.find((a) => a.mac === l.childMac);
          return (
            <DetailRow key={l.childMac} label="Downlink to">
              <JumpButton onClick={() => onSelect({ kind: "ap", id: l.childMac })}>
                {child ? apLabel(child) : l.childMac}
              </JumpButton>
            </DetailRow>
          );
        })}
      </DetailSection>
    </>
  );
}

function LinkDetails({ network, link, onSelect }: { network: McpNetwork; link: McpBackhaulLink; onSelect: Select }) {
  const parent = network.aps.find((a) => a.mac === link.parentMac);
  const child = network.aps.find((a) => a.mac === link.childMac);
  const eth = isEthernet(link);
  const slow = eth && link.rateMbps != null && link.rateMbps < SLOW_ETHERNET_MBPS;
  return (
    <DetailSection title="Backhaul link">
      <DetailRow label="From">
        <JumpButton onClick={() => onSelect({ kind: "ap", id: link.parentMac })}>{parent ? apLabel(parent) : link.parentMac}</JumpButton>
      </DetailRow>
      <DetailRow label="To">
        <JumpButton onClick={() => onSelect({ kind: "ap", id: link.childMac })}>{child ? apLabel(child) : link.childMac}</JumpButton>
      </DetailRow>
      <DetailRow label="Medium">{eth ? "Ethernet" : link.band ? `WiFi · ${link.band}` : "WiFi"}</DetailRow>
      {!eth && <DetailRow label="Backhaul quality">{link.quality ?? "Not rated"}</DetailRow>}
      {!eth && <DetailRow label="RSSI">{link.rssiDbm != null ? `${link.rssiDbm} dBm` : null}</DetailRow>}
      <DetailRow label="Data rate">{formatMbps(link.rateMbps)}</DetailRow>
      {!eth && <DetailRow label="PHY rate">{formatMbps(link.phyRateMbps)}</DetailRow>}
      <DetailRow label="Traffic ↓ / ↑">
        {link.bytesDown != null || link.bytesUp != null ? `${formatBytes(link.bytesDown ?? 0)} / ${formatBytes(link.bytesUp ?? 0)}` : null}
      </DetailRow>
      <DetailRow label="Errors tx / rx">
        {link.errorsTx != null || link.errorsRx != null ? `${link.errorsTx ?? "—"} / ${link.errorsRx ?? "—"}` : null}
      </DetailRow>
      {slow && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Ethernet negotiated below 1 Gbps — often a damaged cable, a 100 Mbps switch, or a bad port.
        </p>
      )}
    </DetailSection>
  );
}

export function NodeDetailPanel({ network, selection, onSelect, onClose }: {
  network: McpNetwork;
  selection: Selection;
  onSelect: Select;
  onClose: () => void;
}) {
  const ap = selection.kind === "ap" ? network.aps.find((a) => a.mac === selection.id) : undefined;
  const member = selection.kind === "client" ? network.members.find((m) => m.id === selection.id) : undefined;
  const link = selection.kind === "link" ? network.backhaul.find((l) => l.childMac === selection.id) : undefined;
  if (!ap && !member && !link) return null;

  const title = ap ? apLabel(ap) : member ? clientName(member) : "Backhaul link";
  const kicker = ap ? "Access point" : member ? "Client" : "Link";

  return (
    <aside
      aria-label={`${kicker} details`}
      className="absolute bottom-3 right-3 top-14 z-10 flex w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
    >
      <header className="flex items-start justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{kicker}</p>
          <h3 className="break-words text-sm font-semibold text-neutral-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {ap && <ApDetails network={network} ap={ap} onSelect={onSelect} />}
        {member && <ClientDetails network={network} member={member} onSelect={onSelect} />}
        {link && <LinkDetails network={network} link={link} onSelect={onSelect} />}
      </div>
    </aside>
  );
}
