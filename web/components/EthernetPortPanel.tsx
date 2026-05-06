"use client";

import { useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { EthernetPort } from "@/app/api/network/[deviceId]/ethernet/route";

export type { EthernetPort };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMax(mbps: number): string {
  if (mbps < 0) return "Auto";
  if (mbps >= 10000) return "10GbE";
  if (mbps >= 5000) return "5GbE";
  if (mbps >= 2500) return "2.5GbE";
  if (mbps >= 1000) return "1GbE";
  return mbps >= 100 ? "100MbE" : (mbps ? `${mbps}M` : "—");
}

function fmtNeg(cur: number, status: string): string {
  if (status !== "Up" || cur <= 0) return "N/A";
  return cur >= 1000 ? `${cur / 1000} Gbps` : `${cur} Mbps`;
}

// ── Rear-view port chip ───────────────────────────────────────────────────────

function PortChip({ port }: { port: EthernetPort & { label: string } }) {
  const active = port.status === "Up";
  const c = active ? (port.upstream ? "#0ea5e9" : "#10b981") : "#9ca3af";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="36" height="32" viewBox="0 0 36 32" fill="none" aria-hidden>
        <rect x="1" y="1" width="34" height="24" rx="3" stroke={c} strokeWidth="1.5" fill={active ? `${c}1a` : "#f9fafb"}/>
        <rect x="6" y="4" width="24" height="15" rx="1.5" stroke={c} strokeWidth="1" fill="white"/>
        {[8.5,11,13.5,16,18.5,21,23.5,26].map((x) => <rect key={x} x={x} y="7" width="1.5" height="7" rx="0.5" fill={c}/>)}
        <rect x="12" y="25" width="12" height="4" rx="1" stroke={c} strokeWidth="1.2" fill={active ? `${c}1a` : "#f9fafb"}/>
      </svg>
      <span className="text-[11px] font-semibold text-neutral-700">{port.label}</span>
    </div>
  );
}

// ── Status cell ───────────────────────────────────────────────────────────────

function StatusCell({ port }: { port: EthernetPort }) {
  if (port.upstream) return (
    <span className="flex items-center gap-1.5 text-sky-600 text-xs">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/></svg>
      WAN
    </span>
  );
  if (port.status === "Up") return (
    <span className="flex items-center gap-1.5 text-emerald-600 text-xs">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 10h16M4 14h16"/><rect x="1" y="7" width="5" height="10" rx="1"/><rect x="18" y="7" width="5" height="10" rx="1"/></svg>
      Wired
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-neutral-400 text-xs">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10h16M4 14h16"/><rect x="1" y="7" width="5" height="10" rx="1"/><rect x="18" y="7" width="5" height="10" rx="1"/><line x1="3" y1="3" x2="21" y2="21" strokeWidth="1.5" stroke="#f87171"/></svg>
      Not connected
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { ports: EthernetPort[] }

export function EthernetPortPanel({ ports }: Props) {
  const labeled = useMemo(() => {
    let lanIdx = 0;
    return ports.map((p) => ({ ...p, label: p.upstream ? "WAN" : `${++lanIdx}` }));
  }, [ports]);

  // Group consecutive ports by max speed for bracket labels
  const speedGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    for (const p of labeled) {
      const l = fmtMax(p.maxBitRate);
      if (groups.length && groups[groups.length - 1].label === l) groups[groups.length - 1].count++;
      else groups.push({ label: l, count: 1 });
    }
    return groups;
  }, [labeled]);

  if (labeled.length === 0) return null;

  const cols = labeled.length;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {/* Rear-view port diagram */}
      <div className="flex flex-col items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-8 py-4">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Rear view</p>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "16px" }}>
          {labeled.map((p) => <PortChip key={p.index} port={p} />)}
        </div>
        {/* Speed bracket row */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "16px", width: "100%" }}>
          {speedGroups.map((g, i) => (
            <div key={i} style={{ gridColumn: `span ${g.count}` }} className="flex flex-col items-center">
              <div className="h-px w-full bg-neutral-200" />
              <span className="mt-0.5 text-[9px] text-neutral-400">{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
              {["Port", "Port status", "Supported speeds", "Negotiated speed", "Port address", "Connected to"].map((h) => (
                <th key={h} className="px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labeled.map((port) => {
              const host = port.connectedHost;
              const connTo = port.upstream ? "WAN" : host?.hostName || host?.ipAddress || (port.status === "Up" ? "—" : "—");
              return (
                <tr key={port.index} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60">
                  <td className="px-4 py-3 font-medium text-neutral-900 whitespace-nowrap">
                    {port.upstream ? "WAN" : `Port ${port.label}`}
                    {!port.enable && <span className="ml-1.5 text-[10px] text-neutral-400">(disabled)</span>}
                  </td>
                  <td className="px-4 py-3"><StatusCell port={port} /></td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium",
                      port.maxBitRate >= 10000 ? "bg-purple-50 text-purple-700"
                      : port.maxBitRate >= 2500 ? "bg-blue-50 text-blue-700"
                      : "bg-neutral-100 text-neutral-600"
                    )}>{fmtMax(port.maxBitRate)}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{fmtNeg(port.currentBitRate, port.status)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">{port.macAddress || "—"}</td>
                  <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">{connTo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
