"use client";

import { EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import type { SwitchEdgeData } from "@/web/lib/topologyFlow";
import { switchUplinkLabel } from "@/web/lib/inferredSwitches";
import { labelBox } from "@/web/lib/edgeGeometry";
import { isSelected, useTopologyUi } from "./TopologyContext";
import { routePath } from "./RouteEdge";
import { FlowPath } from "./FlowPath";
import { BACKHAUL_WIDTH } from "./BackhaulEdge";

/** AP port → inferred switch: an Ethernet line labelled with the port and its rate. */
export function SwitchUplinkEdge(props: EdgeProps<Edge<SwitchEdgeData, "switchUplink">>) {
  const { id, data } = props;
  const ui = useTopologyUi();
  if (!data?.points || data.points.length < 2) return null;
  const { sw } = data;
  const path = routePath(data.points);
  const label = switchUplinkLabel(sw);
  const lb = labelBox(data.points, label, ui.layout === "radial");
  const selected = isSelected(ui, "switch", sw.id);
  const dimmed = !!ui.highlight && !ui.highlight.edges.has(id);
  const toggle = () => ui.select(selected ? null : { kind: "switch", id: sw.id });

  return (
    <g className={cn("transition-opacity", dimmed && "opacity-25")}>
      {selected && <path d={path} fill="none" strokeWidth={13} strokeLinecap="round" className="stroke-violet-400/40" />}
      <path id={id} d={path} fill="none" strokeWidth={BACKHAUL_WIDTH} strokeLinecap="round" className="stroke-neutral-500" />
      <FlowPath path={path} width={BACKHAUL_WIDTH} rateMbps={sw.rateMbps} />
      <path d={path} fill="none" strokeWidth={16} className="cursor-pointer stroke-transparent" />
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
          title={`${sw.source === "live" ? "Gateway" : "AP"} port ${sw.port}${sw.rateMbps ? `, negotiated ${sw.rateMbps} Mbps` : ""}; shared by everything behind the switch`}
        >
          {label}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
