"use client";

import type { McpAccessPoint } from "@/web/lib/mcpNetwork";
import type { ApRadio } from "@/web/lib/wifiRadios";
import { DetailRow, DetailSection } from "./DetailParts";

// Airtime parts, in the order they stack in the bar.
const PARTS = [
  { key: "transmit", label: "Transmitting", color: "bg-blue-600" },
  { key: "receiveSelf", label: "Receiving from own clients", color: "bg-blue-300" },
  { key: "receiveOther", label: "Other networks / interference", color: "bg-neutral-500" },
] as const;

function AirtimeBar({ radio }: { radio: ApRadio }) {
  const total = radio.utilization ?? 0;
  const parts = PARTS.map((p) => ({ ...p, value: Math.max(0, radio[p.key] ?? 0) }));
  // Busy time not split out (e.g. non-decodable energy) fills the rest of "busy".
  const rest = Math.max(0, total - parts.reduce((s, p) => s + p.value, 0));
  const title = [
    `Busy ${total}%${radio.utilizationAvg != null ? ` (average ${radio.utilizationAvg}%)` : ""}`,
    ...parts.map((p) => `${p.label}: ${p.value}%`),
    rest ? `Other busy time: ${rest}%` : null,
  ].filter(Boolean).join("\n");
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100" title={title} role="img" aria-label={title}>
      {parts.map((p) => p.value > 0 && <div key={p.key} className={p.color} style={{ width: `${Math.min(p.value, 100)}%` }} />)}
      {rest > 0 && <div className="bg-neutral-300" style={{ width: `${Math.min(rest, 100)}%` }} />}
    </div>
  );
}

function RadioRow({ radio }: { radio: ApRadio }) {
  return (
    <div className="space-y-1 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-neutral-800">
          {radio.band}
          <span className="font-normal text-neutral-600">
            {radio.channel != null && ` · Ch ${radio.channel}`}
            {radio.widthMhz != null && ` · ${radio.widthMhz} MHz`}
          </span>
        </span>
        <span className="whitespace-nowrap tabular-nums text-neutral-700">
          Busy {radio.utilization ?? "—"}%
          {radio.utilizationAvg != null && <span className="text-neutral-400"> · avg {radio.utilizationAvg}%</span>}
        </span>
      </div>
      <AirtimeBar radio={radio} />
      <div className="flex justify-between gap-2 text-[11px] text-neutral-500">
        <span>Other networks {radio.receiveOther ?? "—"}%</span>
        <span className="tabular-nums">
          {radio.noiseDbm != null && `Noise ${radio.noiseDbm} dBm`}
          {radio.txPowerDbm != null && ` · Tx ${radio.txPowerDbm} dBm`}
        </span>
      </div>
    </div>
  );
}

/** "Radios" section of the AP panel: live channel/airtime from the gateway, else the bands MCP reports. */
export function ApRadios({ ap }: { ap: McpAccessPoint }) {
  return (
    <DetailSection title="Radios">
      {ap.radios?.length ? (
        <>
          <div className="divide-y divide-neutral-100">
            {ap.radios.map((r) => <RadioRow key={`${r.band}-${r.channel}`} radio={r} />)}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 pb-1 pt-0.5 text-[10px] text-neutral-500">
            {PARTS.map((p) => (
              <span key={p.key} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${p.color}`} />{p.label}</span>
            ))}
          </div>
        </>
      ) : (
        <DetailRow label="Bands">{ap.bands.join(" · ")}</DetailRow>
      )}
      <DetailRow label="SSIDs">{ap.ssids.join(", ")}</DetailRow>
    </DetailSection>
  );
}
