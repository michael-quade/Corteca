"use client";

import { Handle, type NodeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { SW_H, SW_W, type SwitchFlowNode } from "@/web/lib/topologyFlow";
import { HIDDEN_HANDLE, handleLayout, isSelected, useTopologyUi } from "./TopologyContext";

export function SwitchGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01" />
    </svg>
  );
}

/** Inferred L2 switch: dashed card, since it is deduced from port data rather than reported. */
export function SwitchNode({ data }: NodeProps<SwitchFlowNode>) {
  const { sw } = data;
  const ui = useTopologyUi();
  const selected = isSelected(ui, "switch", sw.id);
  const handles = handleLayout(ui.layout);
  const parts = [
    sw.beaconMacs.length ? `${sw.beaconMacs.length} Beacon${sw.beaconMacs.length === 1 ? "" : "s"}` : null,
    sw.clientIds.length ? `${sw.clientIds.length} wired client${sw.clientIds.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div
      role="button"
      aria-pressed={selected}
      aria-label={`Inferred switch on ${sw.port}: ${parts.join(", ")}`}
      title="Switch inferred from port data: several devices share one port"
      style={{ width: SW_W, height: SW_H }}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl border-2 border-dashed border-neutral-300 bg-white/90 px-3 shadow-sm transition-shadow hover:shadow-md",
        selected && "border-violet-500 ring-2 ring-violet-500/40"
      )}
    >
      <Handle type="target" position={handles.target} style={handles.style} className={HIDDEN_HANDLE} />
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600"><SwitchGlyph /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Switch · inferred</p>
        <p className="truncate text-xs font-medium text-neutral-800">{parts.join(" · ")}</p>
      </div>
      <Handle type="source" position={handles.source} style={handles.style} className={HIDDEN_HANDLE} />
    </div>
  );
}
