"use client";

import { cn } from "@/web/lib/utils";
import type { McpAccessPoint } from "@/web/lib/mcpNetwork";

const QUALITY_STYLE: Record<string, string> = {
  good: "bg-green-50 text-green-700 ring-green-200",
  fair: "bg-amber-50 text-amber-700 ring-amber-200",
  poor: "bg-red-50 text-red-700 ring-red-200",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="truncate text-right font-medium text-neutral-800">{value}</dd>
    </div>
  );
}

export function McpAccessPointCards({ aps }: { aps: McpAccessPoint[] }) {
  if (aps.length === 0) {
    return <p className="text-sm text-neutral-400">No access points returned by MCP.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {aps.map((ap) => {
        const isRoot = ap.role === "root";
        const quality = ap.backhaulQuality?.toLowerCase();
        return (
          <div key={ap.mac} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{ap.model}</p>
                <p className="font-mono text-xs text-neutral-400">{ap.mac}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  isRoot ? "bg-blue-50 text-blue-700" : "bg-indigo-50 text-indigo-700"
                )}
              >
                {isRoot ? "Gateway" : "Beacon"}
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              <Row
                label="Status"
                value={
                  <span className={cn("inline-flex items-center gap-1.5", ap.online ? "text-green-700" : "text-neutral-400")}>
                    <span className={cn("h-2 w-2 rounded-full", ap.online ? "bg-green-500" : "bg-neutral-300")} />
                    {ap.online ? "Online" : "Offline"}
                  </span>
                }
              />
              {!isRoot && (
                <Row
                  label="Backhaul"
                  value={
                    quality ? (
                      <span className={cn("rounded px-1.5 py-0.5 ring-1", QUALITY_STYLE[quality] ?? "bg-neutral-50 text-neutral-600 ring-neutral-200")}>
                        {ap.backhaulQuality}
                      </span>
                    ) : "—"
                  }
                />
              )}
              <Row label="Clients" value={ap.clientCount} />
              <Row label="Firmware" value={ap.firmware || "—"} />
              <Row label="Serial" value={<span className="font-mono">{ap.serial || "—"}</span>} />
              {ap.ipAddress && <Row label="LAN IP" value={<span className="font-mono">{ap.ipAddress}</span>} />}
              <Row label="Bands" value={ap.bands.join(" · ") || "—"} />
              <Row label="SSIDs" value={ap.ssids.join(", ") || "—"} />
              {ap.lastBoot && <Row label="Last boot" value={new Date(ap.lastBoot).toLocaleString()} />}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
