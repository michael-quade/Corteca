"use client";

import { EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { backhaulLabel, isEthernet, linkQuality, type BackhaulEdgeData, type Quality } from "@/web/lib/topologyFlow";
import { labelBox } from "@/web/lib/edgeGeometry";
import { QUALITY_BORDER, QUALITY_STROKE } from "./qualityStyles";
import { isSelected, useTopologyUi } from "./TopologyContext";
import { routePath } from "./RouteEdge";
import { FlowPath } from "./FlowPath";

// Backhaul lines are wider than client lines; solid = cable, dashed = WiFi (see TopologyLegend).
export const BACKHAUL_WIDTH = 3;
export const WIFI_DASH = "7 5";

export function BackhaulEdge(props: EdgeProps<Edge<BackhaulEdgeData, "backhaul">>) {
  const { id, data } = props;
  const ui = useTopologyUi();
  if (!data?.points || data.points.length < 2) return null;

  // Route and label position come from layoutFlowGraph(), which guarantees the
  // route never runs under another card and the label covers no card or label.
  const path = routePath(data.points);
  const { link } = data;
  const { text: label, slowEth } = backhaulLabel(link);
  const [top, ...rest] = label.split("\n");
  const lb = labelBox(data.points, label, ui.layout === "radial");
  const labelX = lb.x + lb.w / 2, labelY = lb.y + lb.h / 2;
  const eth = isEthernet(link);
  const quality: Quality = eth ? (slowEth ? "fair" : "unknown") : linkQuality(link);
  const selected = isSelected(ui, "link", link.childMac);
  const dimmed = !!ui.highlight && !ui.highlight.edges.has(id);
  const width = BACKHAUL_WIDTH;

  const toggle = () => ui.select(selected ? null : { kind: "link", id: link.childMac });

  return (
    <g className={cn("transition-opacity", dimmed && "opacity-25")}>
      {selected && (
        <path d={path} fill="none" strokeWidth={width + 10} strokeLinecap="round" className="stroke-violet-400/40" />
      )}
      <path
        id={id}
        d={path}
        fill="none"
        strokeWidth={width}
        strokeLinecap={eth ? "round" : "butt"}
        strokeDasharray={eth ? undefined : WIFI_DASH}
        className={eth && !slowEth ? "stroke-neutral-500" : QUALITY_STROKE[quality]}
      />
      {/* Moving dots: the link carries traffic, faster on faster links. */}
      <FlowPath path={path} width={width} rateMbps={link.rateMbps} />
      {/* Wide invisible hit area so thin links are easy to click or tap (handled by onEdgeClick). */}
      <path d={path} fill="none" strokeWidth={16} className="cursor-pointer stroke-transparent" />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={toggle}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "nodrag nopan pointer-events-auto absolute whitespace-nowrap border bg-white px-2.5 py-0.5 text-[11px] font-medium shadow-sm transition-opacity",
            // Stacked WiFi label: band on top, signal · rate below — one line per MLO band (height = labelSize()).
            rest.length > 0 ? "flex flex-col items-center rounded-xl" : "rounded-full",
            eth && !slowEth ? "border-neutral-300 text-neutral-700" : QUALITY_BORDER[quality],
            selected && "ring-2 ring-violet-500/50",
            dimmed && "opacity-25"
          )}
          title={slowEth ? "Ethernet below 1 Gbps — check cable/port" : link.quality ? `Backhaul quality: ${link.quality}` : undefined}
        >
          {rest.length > 0 ? (
            <>
              <span className="text-[10px] font-semibold leading-[14px] opacity-80">{top}</span>
              {rest.map((line, i) => <span key={i} className="leading-4">{line}</span>)}
            </>
          ) : label}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
