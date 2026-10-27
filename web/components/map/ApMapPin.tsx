"use client";

import { StatusPill } from "@/web/components/corteca/StatusPill";
import { cn } from "@/web/lib/utils";

/** An access point on a location map (the gateway, or a Beacon drawn around it). */
export interface LocationAp { id: string; label: string; model: string; online: boolean; isRoot: boolean; clients: number }
type PinNode = Pick<LocationAp, "label" | "model" | "online" | "isRoot">;

/** An access point on the location map: name chip (status dot, client count) on a short stem.
 *  `folded` > 0 = that many Beacons are folded into this (gateway) chip at the current zoom. */
export function ApMapPin({ node, clients, selected, folded = 0, onSelect }: {
  node: PinNode;
  clients: number;
  selected: boolean;
  folded?: number;
  onSelect: () => void;
}) {
  const title = folded > 0
    ? `${node.label} and ${folded} Beacon${folded === 1 ? "" : "s"} · zoom in to show them`
    : `${node.label} · ${clients} client${clients === 1 ? "" : "s"}`;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(); }} className="flex flex-col items-center focus:outline-none" title={title}>
      <span className={cn(
        "flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white py-1 pl-2 pr-1 text-xs font-medium text-neutral-800 shadow-md",
        selected ? "ring-2 ring-blue-600" : "ring-1 ring-neutral-200 hover:ring-neutral-300",
      )}>
        <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", node.online ? "bg-emerald-500" : "bg-red-500")} />
        {node.isRoot && <span className="text-[10px] font-semibold text-neutral-500">Gateway</span>}
        <span className="max-w-[120px] truncate">{node.label}</span>
        <span className="flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 text-[10px] font-semibold tabular-nums text-neutral-600">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" />
          </svg>
          {clients}
        </span>
        {folded > 0 && (
          <span className="rounded-full bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700">+{folded} Beacon{folded === 1 ? "" : "s"}</span>
        )}
      </span>
      <span className="h-2.5 w-px bg-neutral-400" />
      <span className={cn("h-2.5 w-2.5 rounded-full border-2 border-white shadow", selected ? "bg-blue-600" : "bg-neutral-700")} />
    </button>
  );
}

/** Card for the selected access point. */
export function ApMapCard({ node, clients, onClose }: { node: PinNode; clients: number; onClose: () => void }) {
  return (
    <div className="w-56 p-4 font-sans">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-neutral-500">{node.isRoot ? "Gateway" : "Mesh Beacon"}</p>
          <p className="truncate text-sm font-semibold text-neutral-900">{node.label}</p>
          {node.model && node.model !== node.label && <p className="truncate text-xs text-neutral-500">{node.model}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2">
        <StatusPill tone={node.online ? "good" : "poor"}>{node.online ? "Online" : "Offline"}</StatusPill>
        <span className="text-sm font-medium text-neutral-900">{clients} client{clients === 1 ? "" : "s"}</span>
      </div>
      {!node.isRoot && <p className="mt-2 text-[11px] text-neutral-500">Beacons are drawn around the gateway; only the gateway&apos;s location is known.</p>}
    </div>
  );
}
