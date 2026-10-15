"use client";

import type { Edge, EdgeProps } from "@xyflow/react";
import type { Point } from "@/web/lib/edgeGeometry";
import type { RouteEdgeData } from "@/web/lib/topologyFlow";

/** SVG path through a route's points, corners rounded so orthogonal routes read smoothly. */
export function routePath(points: Point[], radius = 10): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1], c = points[i], n = points[i + 1];
    const r = Math.min(radius, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
    const inDir = { x: Math.sign(c.x - p.x), y: Math.sign(c.y - p.y) };
    const outDir = { x: Math.sign(n.x - c.x), y: Math.sign(n.y - c.y) };
    d += ` L${c.x - inDir.x * r} ${c.y - inDir.y * r} Q${c.x} ${c.y} ${c.x + outDir.x * r} ${c.y + outDir.y * r}`;
  }
  const last = points.at(-1)!;
  return `${d} L${last.x} ${last.y}`;
}

/** AP → client-card connector, drawn along the route ELK computed. */
export function RouteEdge({ id, data }: EdgeProps<Edge<RouteEdgeData, "route">>) {
  const points = data?.points ?? [];
  if (points.length < 2) return null;
  return <path id={id} d={routePath(points)} fill="none" strokeWidth={1} className="react-flow__edge-path" />;
}
