"use client";

/** Seconds per dash cycle for a link's flow animation: faster on faster links, none without a rate. */
export function flowSeconds(rateMbps: number | null | undefined): number {
  const rate = rateMbps ?? 0;
  return rate > 0 ? Math.max(0.4, 2.4 - rate / 1000) : 0;
}

/** White dots moving along a link that carries traffic (hidden for reduced motion). */
export function FlowPath({ path, width, rateMbps }: { path: string; width: number; rateMbps: number | null | undefined }) {
  const seconds = flowSeconds(rateMbps);
  if (seconds <= 0) return null;
  return (
    <path
      d={path}
      fill="none"
      strokeWidth={Math.max(1, width - 1.5)}
      strokeLinecap="round"
      strokeDasharray="2 22"
      style={{ animationDuration: `${seconds}s` }}
      className="pointer-events-none stroke-white/80 motion-safe:animate-flow-dash motion-reduce:hidden"
    />
  );
}
