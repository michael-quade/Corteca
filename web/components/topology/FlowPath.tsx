"use client";

/** Seconds per dash cycle for a link's flow animation: faster on faster links, none without a rate. */
export function flowSeconds(rateMbps: number | null | undefined): number {
  const rate = rateMbps ?? 0;
  // Floor at 0.8 s (30 px/s): faster than that the dots blur into flicker.
  return rate > 0 ? Math.max(0.8, 2.4 - rate / 1000) : 0;
}

// One dot per 24 px (the flow-dash keyframe's offset); a zero-length dash with a round cap is a circle.
const DOTS = "0 24";

/**
 * Moving dots on a link that carries traffic (hidden for reduced motion): white circles a little wider
 * than the line, each with a dark ring, so they stand out on any line colour and over the gaps of a
 * dashed WiFi line.
 */
export function FlowPath({ path, width, rateMbps }: { path: string; width: number; rateMbps: number | null | undefined }) {
  const seconds = flowSeconds(rateMbps);
  if (seconds <= 0) return null;
  const dot = width + 2;
  const style = { animationDuration: `${seconds}s` };
  const cls = "pointer-events-none motion-safe:animate-flow-dash motion-reduce:hidden";
  return (
    <g>
      <path d={path} fill="none" strokeWidth={dot + 2} strokeLinecap="round" strokeDasharray={DOTS}
        style={style} className={`${cls} stroke-neutral-900/45`} />
      <path d={path} fill="none" strokeWidth={dot} strokeLinecap="round" strokeDasharray={DOTS}
        style={style} className={`${cls} stroke-white`} />
    </g>
  );
}
