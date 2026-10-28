"use client";

import { EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import type { WanEdgeData } from "@/web/lib/topologyFlow";
import { labelBox } from "@/web/lib/edgeGeometry";
import { isSelected, useTopologyUi } from "./TopologyContext";
import { routePath } from "./RouteEdge";
import { FlowPath } from "./FlowPath";
import { BACKHAUL_WIDTH } from "./BackhaulEdge";

/** Internet → gateway: the WAN link, with a "WAN · 5 Gbps" pill that opens the WAN details. */
export function WanEdge(props: EdgeProps<Edge<WanEdgeData, "wan">>) {
  const { id, data } = props;
  const ui = useTopologyUi();
  if (!data?.points || data.points.length < 2) return null;
  const path = routePath(data.points);
  const lb = labelBox(data.points, data.label, ui.layout === "radial");
  const selected = isSelected(ui, "wan", data.gatewayMac);
  const dimmed = !!ui.highlight && !ui.highlight.edges.has(id);
  const toggle = () => ui.select(selected ? null : { kind: "wan", id: data.gatewayMac });

  return (
    <g className={cn("transition-opacity", dimmed && "opacity-25")}>
      {selected && <path d={path} fill="none" strokeWidth={13} strokeLinecap="round" className="stroke-violet-400/40" />}
      <path id={id} d={path} fill="none" strokeWidth={BACKHAUL_WIDTH} strokeLinecap="round" className="stroke-blue-500" />
      <FlowPath path={path} width={BACKHAUL_WIDTH} rateMbps={data.rateMbps} />
      <path d={path} fill="none" strokeWidth={16} className="cursor-pointer stroke-transparent" onClick={toggle} />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={toggle}
          style={{ transform: `translate(-50%, -50%) translate(${lb.x + lb.w / 2}px, ${lb.y + lb.h / 2}px)` }}
          className={cn(
            "nodrag nopan pointer-events-auto absolute whitespace-nowrap rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-blue-700 shadow-sm transition-opacity hover:bg-blue-50",
            selected && "ring-2 ring-violet-500/50",
            dimmed && "opacity-25"
          )}
          title="Gateway WAN port: negotiated link speed. Click for WAN details."
        >
          {data.label}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
