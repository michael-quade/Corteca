"use client";

import { Handle, type NodeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { CLUSTER_W, type Band, type ClientSection, type ClusterFlowNode } from "@/web/lib/topologyFlow";
import { QUALITY_BG, QUALITY_LABEL } from "./qualityStyles";
import { HIDDEN_HANDLE, handleLayout, isSelected, useTopologyUi } from "./TopologyContext";

const BAND_CHIP: Record<Band, string> = {
  "6 GHz": "bg-violet-100 text-violet-700",
  "5 GHz": "bg-sky-100 text-sky-700",
  "2.4 GHz": "bg-teal-100 text-teal-700",
  Wired: "bg-neutral-200 text-neutral-700",
  Other: "bg-neutral-100 text-neutral-600",
};

function Section({ section, onToggle }: { section: ClientSection; onToggle: () => void }) {
  const { band, total, pills, hidden, expanded } = section;
  const ui = useTopologyUi();
  return (
    <div>
      <div className="mb-2 flex h-[14px] items-center gap-2">
        <span className={cn("rounded px-1.5 text-[10px] font-semibold leading-[14px]", BAND_CHIP[band])}>{band}</span>
        <span className="text-[11px] text-neutral-500">{total} client{total === 1 ? "" : "s"}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pills.map((p) => (
          <button
            type="button"
            key={p.id}
            style={{ width: p.width }}
            onClick={(e) => {
              e.stopPropagation();
              ui.select(isSelected(ui, "client", p.id) ? null : { kind: "client", id: p.id });
            }}
            title={`${p.name}${p.signal ? ` · signal ${QUALITY_LABEL[p.signal].toLowerCase()}` : " · wired"}`}
            className={cn(
              "nodrag nopan flex items-center gap-1.5 rounded-full border bg-white px-2.5 text-left text-xs text-neutral-800 transition-opacity hover:border-neutral-400",
              p.twoLines ? "h-[38px] rounded-2xl" : "h-6",
              isSelected(ui, "client", p.id) ? "border-violet-500 ring-2 ring-violet-500/40" : "border-neutral-200",
              !ui.clientVisible(p.id) && "opacity-20"
            )}
          >
            {p.signal && <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", QUALITY_BG[p.signal])} />}
            <span className={cn("min-w-0 leading-tight", p.twoLines ? "line-clamp-2 break-all" : "truncate")}>{p.name}</span>
          </button>
        ))}
        {(hidden > 0 || expanded) && (
          <button
            type="button"
            onClick={onToggle}
            className="nodrag nopan h-6 w-11 rounded-full border border-dashed border-neutral-300 bg-white text-xs font-medium text-neutral-600 hover:border-neutral-500 hover:text-neutral-900"
            title={expanded ? "Show fewer" : `Show ${hidden} more`}
          >
            {expanded ? "less" : `+${hidden}`}
          </button>
        )}
      </div>
    </div>
  );
}

// One node per AP: its connected clients, stacked by band.
export function ClientClusterNode({ data }: NodeProps<ClusterFlowNode>) {
  const { sections, onToggle } = data;
  const handles = handleLayout(useTopologyUi().layout);

  return (
    <div style={{ width: CLUSTER_W }} className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/90 p-3">
      {sections.map((s) => (
        <Section key={s.id} section={s} onToggle={() => onToggle(s.id)} />
      ))}
      {/* Last child so space-y doesn't push the first section down. */}
      <Handle type="target" position={handles.target} style={handles.style} className={HIDDEN_HANDLE} />
    </div>
  );
}
