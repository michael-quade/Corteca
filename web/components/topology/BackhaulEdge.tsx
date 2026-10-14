"use client";

import { EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { isEthernet, linkQuality, type BackhaulEdgeData } from "@/web/lib/topologyFlow";
import { QUALITY_BORDER, QUALITY_STROKE } from "./qualityStyles";

function formatRate(mbps: number): string {
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)} Gbps` : `${mbps} Mbps`;
}

export function BackhaulEdge(props: EdgeProps<Edge<BackhaulEdgeData, "backhaul">>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  // Label sits 70% of the way to the child: links fanning out of one AP all
  // share a parent, so their midpoints crowd together under it. x follows the
  // vertical bezier's ease (3t² − 2t³); y is close to linear.
  const t = 0.7;
  const labelX = sourceX + (targetX - sourceX) * (3 * t * t - 2 * t * t * t);
  const labelY = sourceY + (targetY - sourceY) * t;
  if (!data) return null;

  const { link } = data;
  const eth = isEthernet(link);
  const quality = eth ? "unknown" : linkQuality(link);
  const rate = link.rateMbps ?? 0;
  // Stroke width encodes throughput; animation speed follows it too.
  const width = eth ? 3 : 1.5 + Math.min(4, rate / 400);
  const flowSeconds = rate > 0 ? Math.max(0.4, 2.4 - rate / 1000) : 0;

  const parts = [
    eth ? "Ethernet" : null,
    !eth && link.rssiDbm != null ? `${link.rssiDbm} dBm` : null,
    rate > 0 ? formatRate(rate) : null,
  ].filter(Boolean);
  const label = parts.join(" · ") || (eth ? "Ethernet" : "WiFi backhaul");

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={quality === "poor" ? "8 6" : undefined}
        className={eth ? "stroke-neutral-500" : QUALITY_STROKE[quality]}
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
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "pointer-events-auto absolute whitespace-nowrap rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-medium shadow-sm",
            eth ? "border-neutral-300 text-neutral-700" : QUALITY_BORDER[quality]
          )}
          title={link.quality ? `Corteca backhaul quality: ${link.quality}` : undefined}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
