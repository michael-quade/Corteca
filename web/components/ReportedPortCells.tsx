"use client";

import type { ReportedPort } from "@/web/lib/meshApPorts";

// Cells for a mesh AP port built from Corteca's reports (meshApPorts.ts) rather
// than live port status. A port with nothing reported is neutral — it may be empty.

const NOTHING = <span className="text-neutral-400">Nothing reported</span>;

export function ReportedStatusCell({ reported }: { reported: ReportedPort }) {
  if (reported.kind === "none") return <span className="text-xs">{NOTHING}</span>;
  if (reported.kind === "uplink") return (
    <span className="flex items-center gap-1.5 text-xs text-sky-600">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      Uplink
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-600">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 10h16M4 14h16"/><rect x="1" y="7" width="5" height="10" rx="1"/><rect x="18" y="7" width="5" height="10" rx="1"/></svg>
      Wired
    </span>
  );
}

export function ReportedConnectedTo({ reported, open, onToggle }: { reported: ReportedPort; open: boolean; onToggle: () => void }) {
  if (reported.kind === "none") return NOTHING;
  if (reported.kind === "uplink") return <>Backhaul · {reported.uplink}</>;
  if (reported.kind === "device") {
    const d = reported.devices[0];
    return <span title={d.mac}>{d.name}</span>;
  }
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="font-medium text-blue-600 hover:underline">
      Switch · {reported.devices.length} devices {open ? "▴" : "▾"}
    </button>
  );
}

export function ReportedSwitchRow({ reported }: { reported: ReportedPort }) {
  return (
    <tr className="bg-neutral-50">
      <td colSpan={6} className="px-4 pb-3 pt-1">
        <div className="flex flex-wrap gap-2 text-xs">
          {reported.devices.map((d) => (
            <span key={d.mac} className="rounded-full bg-white px-2.5 py-1 text-neutral-700 ring-1 ring-neutral-200" title={d.mac}>{d.name}</span>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-400">
          Inferred: Corteca reports these wired devices on the same port, so a switch is connected.
          The negotiated speed is the port↔switch link, not each device&apos;s.
        </p>
      </td>
    </tr>
  );
}

