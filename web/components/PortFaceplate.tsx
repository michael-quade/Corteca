"use client";

import { formatRate } from "@/web/lib/rateFormat";
import type { MeshPort } from "@/web/lib/meshApPorts";

// RJ-45 ports: the rear-view faceplate of the REST visualizer's port panel, and the jack
// icon on each port row of the MCP visualizer's AP panel. Live ports are coloured by link
// status; mesh Beacon ports built from Corteca reports by what is reported (dashed = nothing reported).

export type PortTone = "wired" | "wan" | "wireless" | "empty" | "unknown";

export interface FaceplatePort {
  key: number;
  label: string;
  tone: PortTone;
  /** Negotiated speed. */
  rate?: string;
  /** Supported speed, for the bracket row. */
  maxLabel?: string;
  title?: string;
}

const COLOR: Record<PortTone, string> = { wired: "#10b981", wan: "#0ea5e9", wireless: "#0ea5e9", empty: "#9ca3af", unknown: "#9ca3af" };

/** Tone and negotiated rate of a live, config/spec or reported port. */
export function portTone(p: MeshPort): { tone: PortTone; rate?: string } {
  const rate = p.currentBitRate > 0 ? formatRate(p.currentBitRate) : undefined;
  const r = p.reported;
  if (r) {
    if (r.kind === "none") return { tone: "unknown" };
    if (r.kind === "wireless") return { tone: "wireless" };
    return { tone: r.kind === "uplink" ? "wan" : "wired", rate };
  }
  if (p.status !== "Up") return { tone: p.status === "Unknown" ? "unknown" : "empty" };
  return { tone: p.upstream ? "wan" : "wired", rate };
}

/** One RJ-45 jack, coloured by tone (dashed = nothing reported / wireless). */
export function PortIcon({ tone, size = 36 }: { tone: PortTone; size?: number }) {
  const c = COLOR[tone];
  const active = tone === "wired" || tone === "wan";
  const dash = tone === "unknown" || tone === "wireless" ? "3 2" : undefined;
  return (
    <svg width={size} height={(size * 32) / 36} viewBox="0 0 36 32" fill="none" aria-hidden className="flex-shrink-0">
      <rect x="1" y="1" width="34" height="24" rx="3" stroke={c} strokeWidth="1.5" strokeDasharray={dash} fill={active ? `${c}1a` : "#f9fafb"}/>
      <rect x="6" y="4" width="24" height="15" rx="1.5" stroke={c} strokeWidth="1" fill="white"/>
      {[8.5,11,13.5,16,18.5,21,23.5,26].map((x) => <rect key={x} x={x} y="7" width="1.5" height="7" rx="0.5" fill={c}/>)}
      <rect x="12" y="25" width="12" height="4" rx="1" stroke={c} strokeWidth="1.2" fill={active ? `${c}1a` : "#f9fafb"}/>
    </svg>
  );
}

function PortChip({ port }: { port: FaceplatePort }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={port.title}>
      <PortIcon tone={port.tone} />
      <span className="whitespace-nowrap text-[11px] font-semibold text-neutral-700">{port.label}</span>
    </div>
  );
}

/** The faceplate, with a "Rear view" caption and a supported-speed bracket row. */
export function PortFaceplate({ ports }: { ports: FaceplatePort[] }) {
  if (!ports.length) return null;
  const cols = { display: "grid", gridTemplateColumns: `repeat(${ports.length}, minmax(0, 1fr))`, gap: "16px" } as const;

  const groups: { label: string; count: number }[] = [];
  for (const p of ports) {
    const l = p.maxLabel ?? "—";
    if (groups.length && groups[groups.length - 1].label === l) groups[groups.length - 1].count++;
    else groups.push({ label: l, count: 1 });
  }
  return (
    <div className="flex flex-col items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-8 py-4">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Rear view</p>
      <div style={cols}>{ports.map((p) => <PortChip key={p.key} port={p} />)}</div>
      <div style={{ ...cols, width: "100%" }}>
        {groups.map((g, i) => (
          <div key={i} style={{ gridColumn: `span ${g.count}` }} className="flex flex-col items-center">
            <div className="h-px w-full bg-neutral-200" />
            <span className="mt-0.5 text-[9px] text-neutral-400">{g.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
