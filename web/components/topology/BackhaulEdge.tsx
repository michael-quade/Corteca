"use client";

import { EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { backhaulLabel, isEthernet, linkQuality, type BackhaulEdgeData, type Quality } from "@/web/lib/topologyFlow";
import { labelBox } from "@/web/lib/edgeGeometry";
import { QUALITY_BORDER, QUALITY_STROKE } from "./qualityStyles";
import { isSelected, useTopologyUi } from "./TopologyContext";
import { routePath } from "./RouteEdge";

export function BackhaulEdge(props: EdgeProps<Edge<BackhaulEdgeData, "backhaul">>) {
  const { id, data } = props;
  const ui = useTopologyUi();
  if (!data?.points || data.points.length < 2) return null;

  // Route and label position come from layoutFlowGraph(), which guarantees the
  // route never runs under another card and the label covers no card or label.
  const path = routePath(data.points);
  const { link } = data;
  const { text: label, slowEth } = backhaulLabel(link);
  const lb = labelBox(data.points, label, ui.layout === "radial");
  const labelX = lb.x + lb.w / 2, labelY = lb.y + lb.h / 2;
  const eth = isEthernet(link);
  const rate = link.rateMbps ?? 0;
  const quality: Quality = eth ? (slowEth ? "fair" : "unknown") : linkQuality(link);
  const selected = isSelected(ui, "link", link.childMac);
  const dimmed = !!ui.highlight && !ui.highlight.edges.has(id);
  // Stroke width encodes throughput; animation speed follows it too.
  const width = eth ? 3 : 1.5 + Math.min(4, rate / 400);
  const flowSeconds = rate > 0 ? Math.max(0.4, 2.4 - rate / 1000) : 0;

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
        strokeLinecap="round"
        strokeDasharray={quality === "poor" ? "8 6" : undefined}
        className={eth && !slowEth ? "stroke-neutral-500" : QUALITY_STROKE[quality]}
      />
      {flowSeconds > 0 && (
        <path
          d={path}
          fill="none"
          strokeWidth={Math.max(1, width - 1.5)}
          strokeLinecap="round"
          strokeDasharray="2 22"
          style={{ animationDuration: `${flowSeconds}s` }}
          className="pointer-events-none stroke-white/80 motion-safe:animate-flow-dash motion-reduce:hidden"
        />
      )}
      {/* Wide invisible hit area so thin links are easy to click or tap (handled by onEdgeClick). */}
      <path d={path} fill="none" strokeWidth={16} className="cursor-pointer stroke-transparent" />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={toggle}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "nodrag nopan pointer-events-auto absolute whitespace-nowrap rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-medium shadow-sm transition-opacity",
            eth && !slowEth ? "border-neutral-300 text-neutral-700" : QUALITY_BORDER[quality],
            selected && "ring-2 ring-violet-500/50",
            dimmed && "opacity-25"
          )}
          title={slowEth ? "Ethernet below 1 Gbps — check cable/port" : link.quality ? `Backhaul quality: ${link.quality}` : undefined}
        >
          {label}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
