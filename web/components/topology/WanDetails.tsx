"use client";

import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { formatBytes } from "@/web/lib/clientInsights";
import { wanConnected, wanNatNote } from "@/web/lib/wanInfo";
import type { Selection } from "@/web/lib/topologySelection";
import { DetailRow, DetailSection, JumpButton, apLabel, formatDuration, formatMbps } from "./DetailParts";

const CONNECTION_TYPE: Record<string, string> = { IP_Routed: "Routed", IP_Bridged: "Bridged", PPPoE_Bridged: "PPPoE bridged" };

/** WAN panel: the gateway's Internet connection and WAN port, read live from the gateway (TR-181). */
export function WanDetails({ network, gateway, onSelect }: { network: McpNetwork; gateway: McpAccessPoint; onSelect: (s: Selection) => void }) {
  const wan = network.wan;
  if (wan === undefined) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-xs text-neutral-500">
        <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-blue-600" />
        Reading WAN status from the gateway…
      </p>
    );
  }
  const info = wan === "error" ? null : wan;
  const up = info ? wanConnected(info) : null;
  const nat = wanNatNote(info?.ipv4 ?? null);
  const port = info?.port;

  return (
    <>
      <DetailSection title="Internet">
        <DetailRow label="Gateway">
          <JumpButton onClick={() => onSelect({ kind: "ap", id: gateway.mac })}>{apLabel(gateway)}</JumpButton>
        </DetailRow>
        <DetailRow label="Status">{info ? (up ? "Connected" : info.connection ?? info.status) : null}</DetailRow>
        <DetailRow label="Public IP" mono>{gateway.wanIp}</DetailRow>
        <DetailRow label="Uptime">{info?.uptimeSec != null ? formatDuration(info.uptimeSec) : null}</DetailRow>
        <DetailRow label="Traffic ↓ / ↑">
          {info && (info.bytesDown != null || info.bytesUp != null) ? `${formatBytes(info.bytesDown ?? 0)} / ${formatBytes(info.bytesUp ?? 0)}` : null}
        </DetailRow>
      </DetailSection>
      {!info ? (
        <p className="px-4 py-3 text-xs text-neutral-500">WAN details unavailable: the gateway didn&apos;t answer (it may be offline).</p>
      ) : (
        <>
          <DetailSection title="WAN interface">
            <DetailRow label="WAN interface" mono>{info.interfaceName}</DetailRow>
            <DetailRow label="Services">{info.services.join(", ")}</DetailRow>
            <DetailRow label="Connection">{info.connectionType ? CONNECTION_TYPE[info.connectionType] ?? info.connectionType : null}</DetailRow>
            <DetailRow label="Addressing">{info.addressing}</DetailRow>
            <DetailRow label="VLAN">{info.vlanId}</DetailRow>
            <DetailRow label="WAN IP address" mono>{info.ipv4}</DetailRow>
            <DetailRow label="WAN IPv6 address" mono>{info.ipv6.length ? info.ipv6.map((ip) => <span key={ip} className="block">{ip}</span>) : null}</DetailRow>
            <DetailRow label="Default gateway" mono>{info.gateway}</DetailRow>
            <DetailRow label="DNS servers" mono>{info.dns.length ? info.dns.map((ip) => <span key={ip} className="block">{ip}</span>) : null}</DetailRow>
            <DetailRow label="LAN IP address" mono>{info.lanIpv4}</DetailRow>
            {nat && <p className="mt-2 rounded-md bg-blue-50 px-2 py-1.5 text-[11px] text-blue-800">{nat}</p>}
          </DetailSection>
          <DetailSection title="WAN port">
            <DetailRow label="Medium">{info.medium}</DetailRow>
            {port && (
              <>
                <DetailRow label="Port" mono>{port.name}</DetailRow>
                <DetailRow label="Link">{port.status}</DetailRow>
                <DetailRow label="Max bit rate">{formatMbps(port.maxMbps)}</DetailRow>
                <DetailRow label="Current bit rate">{port.status === "Up" ? formatMbps(port.currentMbps) : null}</DetailRow>
                <DetailRow label="Duplex mode">{port.duplex}</DetailRow>
                <DetailRow label="MAC" mono>{port.mac}</DetailRow>
              </>
            )}
          </DetailSection>
          <p className="px-4 pb-3 text-[11px] text-neutral-400">Live from the gateway (TR-181).</p>
        </>
      )}
    </>
  );
}
