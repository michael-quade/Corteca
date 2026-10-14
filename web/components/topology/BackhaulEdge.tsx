"use client";

import { EdgeLabelRenderer, getBezierPath, getStraightPath, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { isEthernet, linkQuality, type BackhaulEdgeData, type Quality } from "@/web/lib/topologyFlow";
import { QUALITY_BORDER, QUALITY_STROKE } from "./qualityStyles";
import { isSelected, useTopologyUi } from "./TopologyContext";

/** Ethernet backhaul that negotiated below gigabit usually means a bad cable or port. */
export const SLOW_ETHERNET_MBPS = 1000;

function formatRate(mbps: number): string {
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)} Gbps` : `${mbps} Mbps`;
}

export function BackhaulEdge(props: EdgeProps<Edge<BackhaulEdgeData, "backhaul">>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const ui = useTopologyUi();
  const radial = ui.layout === "radial";
  const [path] = radial
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  // In tree/sideways the label sits past the midpoint toward the child: links
  // fanning out of one AP share a parent, so their midpoints crowd together
  // next to it. Along the main axis the bezier eases (3t² − 2t³); across it,
  // it is close to linear. Radial links are straight, centre to centre, so the
  // midpoint is the gap between the two cards.
  const horizontal = ui.layout === "horizontal";
  const t = radial ? 0.5 : horizontal ? 0.6 : 0.7, ease = 3 * t * t - 2 * t * t * t;
  const labelX = sourceX + (targetX - sourceX) * (radial || horizontal ? t : ease);
  const labelY = sourceY + (targetY - sourceY) * (radial || !horizontal ? t : ease);
  if (!data) return null;

  const { link } = data;
  const eth = isEthernet(link);
  const rate = link.rateMbps ?? 0;
  const slowEth = eth && rate > 0 && rate < SLOW_ETHERNET_MBPS;
  const quality: Quality = eth ? (slowEth ? "fair" : "unknown") : linkQuality(link);
  const selected = isSelected(ui, "link", link.childMac);
  const dimmed = !!ui.highlight && !ui.highlight.edges.has(id);
  // Stroke width encodes throughput; animation speed follows it too.
  const width = eth ? 3 : 1.5 + Math.min(4, rate / 400);
  const flowSeconds = rate > 0 ? Math.max(0.4, 2.4 - rate / 1000) : 0;

  const parts = [
    eth ? "Ethernet" : null,
    !eth && link.rssiDbm != null ? `${link.rssiDbm} dBm` : null,
    rate > 0 ? formatRate(rate) : null,
  ].filter(Boolean);
  const label = parts.join(" · ") || (eth ? "Ethernet" : "WiFi backhaul");
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
          title={slowEth ? "Ethernet below 1 Gbps — check cable/port" : link.quality ? `Corteca backhaul quality: ${link.quality}` : undefined}
        >
          {slowEth && "⚠ "}{label}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
