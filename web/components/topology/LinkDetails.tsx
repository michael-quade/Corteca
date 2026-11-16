"use client";

import type { BackhaulBand, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { SLOW_ETHERNET_MBPS, isEthernet } from "@/web/lib/topologyFlow";
import { formatBytes } from "@/web/lib/clientInsights";
import type { Selection } from "@/web/lib/topologySelection";
import { DetailRow, DetailSection, JumpButton, apLabel, formatMbps } from "./DetailParts";

type Select = (sel: Selection) => void;

/** An MLO backhaul's bands, one row each: channel · width, then signal · data rate (PHY). */
function MloBands({ bands }: { bands: BackhaulBand[] }) {
  return (
    <DetailSection title={`Bands (MLO · ${bands.length})`} summary={bands.map((b) => b.band ?? "WiFi").join(" + ")}>
      {bands.map((b, i) => (
        <DetailRow key={b.staMac ?? i} label={[b.band ?? "WiFi", b.channel != null && `Ch ${b.channel}`, b.widthMhz && `${b.widthMhz} MHz`].filter(Boolean).join(" · ")}>
          {[
            b.rssiDbm != null && `${b.rssiDbm} dBm`,
            b.rateMbps != null && formatMbps(b.rateMbps),
            b.phyRateMbps != null && b.phyRateMbps !== b.rateMbps && `PHY ${formatMbps(b.phyRateMbps)}`,
          ].filter(Boolean).join(" · ") || null}
        </DetailRow>
      ))}
    </DetailSection>
  );
}

/** The backhaul link panel (+ its MLO bands). */
export function LinkDetails({ network, link, onSelect }: { network: McpNetwork; link: McpBackhaulLink; onSelect: Select }) {
  const parent = network.aps.find((a) => a.mac === link.parentMac);
  const child = network.aps.find((a) => a.mac === link.childMac);
  const eth = isEthernet(link);
  const slow = eth && link.rateMbps != null && link.rateMbps < SLOW_ETHERNET_MBPS;
  // WiFi standard from the gateway (applyWifiDetails); without it the band-only view stays.
  const std = eth ? undefined : link.standard;
  const medium = eth ? "Ethernet" : [std ? `${std.generation} (${std.ieee})` : "WiFi", link.band].filter(Boolean).join(" · ");
  const mlo = link.mloBands;
  return (
    <>
    <DetailSection title="Backhaul link" summary={[medium, link.rateMbps ? formatMbps(link.rateMbps) : null, link.quality].filter(Boolean).join(" · ")}>
      <DetailRow label="From">
        <JumpButton onClick={() => onSelect({ kind: "ap", id: link.parentMac })}>{parent ? apLabel(parent) : link.parentMac}</JumpButton>
      </DetailRow>
      <DetailRow label="To">
        <JumpButton onClick={() => onSelect({ kind: "ap", id: link.childMac })}>{child ? apLabel(child) : link.childMac}</JumpButton>
      </DetailRow>
      <DetailRow label="Medium">{medium}</DetailRow>
      {!eth && link.channel != null && (
        <DetailRow label="Channel">{[link.channel, link.widthMhz && `${link.widthMhz} MHz`].filter(Boolean).join(" · ")}</DetailRow>
      )}
      {eth && <DetailRow label="Gateway port">{link.port}</DetailRow>}
      {std?.generation === "WiFi 7" && <DetailRow label="Multi-link (MLO)">{std.mlo ? "Yes" : "No"}</DetailRow>}
      {!eth && <DetailRow label="Backhaul quality">{link.quality ?? "Not rated"}</DetailRow>}
      {!eth && !mlo && <DetailRow label="RSSI">{link.rssiDbm != null ? `${link.rssiDbm} dBm` : null}</DetailRow>}
      <DetailRow label={mlo ? "Data rate (all bands)" : "Data rate"}>{formatMbps(link.rateMbps)}</DetailRow>
      {!eth && <DetailRow label={mlo ? "PHY rate (all bands)" : "PHY rate"}>{formatMbps(link.phyRateMbps)}</DetailRow>}
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
    {mlo && <MloBands bands={mlo} />}
    </>
  );
}
