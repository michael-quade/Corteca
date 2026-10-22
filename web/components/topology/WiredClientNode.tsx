"use client";

import { Handle, type NodeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { WIRED_H } from "@/web/lib/clientCluster";
import { clientName, type WiredFlowNode } from "@/web/lib/topologyFlow";
import { HIDDEN_HANDLE, handleLayout, isSelected, useTopologyUi } from "./TopologyContext";

/** A wired client as its own pill, linked from the AP or switch port it is plugged into. */
export function WiredClientNode({ data, width }: NodeProps<WiredFlowNode>) {
  const { member } = data;
  const ui = useTopologyUi();
  const selected = isSelected(ui, "client", member.id);
  const handles = handleLayout(ui.layout);
  const name = clientName(member);

  return (
    <div
      role="button"
      aria-pressed={selected}
      aria-label={`Wired client ${name}`}
      style={{ width, height: WIRED_H }}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 text-xs text-neutral-800 shadow-sm transition-opacity hover:border-neutral-400",
        selected ? "border-violet-500 ring-2 ring-violet-500/40" : "border-neutral-300",
        !ui.clientVisible(member.id) && "opacity-20"
      )}
    >
      <Handle type="target" position={handles.target} style={handles.style} className={HIDDEN_HANDLE} />
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-neutral-500" aria-hidden>
        <path d="M7 4h10v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM10 4V2M14 4V2M12 13v8" />
      </svg>
      <span className="truncate">{name}</span>
    </div>
  );
}
