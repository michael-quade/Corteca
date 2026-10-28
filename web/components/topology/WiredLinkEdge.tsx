"use client";

import { EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import type { WiredEdgeData } from "@/web/lib/topologyFlow";
import { labelBox } from "@/web/lib/edgeGeometry";
import { isSelected, useTopologyUi } from "./TopologyContext";
import { routePath } from "./RouteEdge";

/** AP or switch port → wired client, labelled "LAN 3 · 100M" (no label behind a switch). */
export function WiredLinkEdge(props: EdgeProps<Edge<WiredEdgeData, "wiredLink">>) {
  const { id, data } = props;
  const ui = useTopologyUi();
  if (!data?.points || data.points.length < 2) return null;
  const { member, label } = data;
  const path = routePath(data.points);
  const selected = isSelected(ui, "client", member.id);
  const dimmed = (!!ui.highlight && !ui.highlight.edges.has(id)) || !ui.clientVisible(member.id);
  const lb = label ? labelBox(data.points, label, ui.layout === "radial") : null;
  const toggle = () => ui.select(selected ? null : { kind: "client", id: member.id });

  return (
    <g className={cn("transition-opacity", dimmed && "opacity-25")}>
      {selected && <path d={path} fill="none" strokeWidth={10} strokeLinecap="round" className="stroke-violet-400/40" />}
      <path id={id} d={path} fill="none" strokeWidth={2} strokeLinecap="round" className="stroke-neutral-500" />
      <path d={path} fill="none" strokeWidth={14} className="cursor-pointer stroke-transparent" />
      {lb && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={toggle}
            style={{ transform: `translate(-50%, -50%) translate(${lb.x + lb.w / 2}px, ${lb.y + lb.h / 2}px)` }}
            className={cn(
              "nodrag nopan pointer-events-auto absolute whitespace-nowrap rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 shadow-sm transition-opacity",
              selected && "ring-2 ring-violet-500/50",
              dimmed && "opacity-25"
            )}
          >
            {label}
          </button>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
