"use client";

import Link from "next/link";
import { OpenBadge } from "./LandingCard";

// A gateway and three beacons on a soft blue cloud — the mesh the page visualises.
function MeshIllustration() {
  return (
    <svg viewBox="0 0 360 200" className="h-auto w-full" aria-hidden>
      <defs>
        <radialGradient id="featured-cloud" cx="50%" cy="75%" r="65%">
          <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.95" />
          <stop offset="55%" stopColor="rgb(59 130 246)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="180" cy="190" rx="190" ry="120" fill="url(#featured-cloud)" />
      <g className="stroke-white" strokeWidth="3" strokeLinecap="round" opacity="0.9">
        <line x1="180" y1="78" x2="88" y2="140" />
        <line x1="180" y1="78" x2="180" y2="150" />
        <line x1="180" y1="78" x2="272" y2="140" strokeDasharray="7 6" />
      </g>
      {[
        { x: 180, y: 78, w: 46, h: 58, gw: true },
        { x: 88, y: 140, w: 36, h: 44 },
        { x: 180, y: 150, w: 36, h: 44 },
        { x: 272, y: 140, w: 36, h: 44 },
      ].map((b) => (
        <g key={`${b.x}-${b.y}`} transform={`translate(${b.x - b.w / 2} ${b.y - b.h / 2})`}>
          {/* Outline + soft shadow so the upper cards don't vanish into the white tile. */}
          <rect x="1" y="3" width={b.w} height={b.h} rx="10" className="fill-blue-900/10" />
          <rect width={b.w} height={b.h} rx="10" strokeWidth="1.5" className="fill-white stroke-blue-200" />
          <rect x={b.w * 0.2} y={b.h * 0.18} width={b.w * 0.6} height="5" rx="2.5" className={b.gw ? "fill-blue-600" : "fill-neutral-800"} />
          <circle cx={b.w / 2} cy={b.h * 0.72} r="3.5" className="fill-emerald-500" />
        </g>
      ))}
    </svg>
  );
}

/** Tall feature tile (the "Marketplace" slot on the Corteca console home). */
export function FeaturedCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-neutral-200/70 transition-all hover:shadow-md hover:ring-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <div className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <span className="mb-2 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Corteca AI · MCP</span>
          <span className="block text-lg font-medium text-neutral-900">{title}</span>
          <span className="mt-1 block text-[13px] leading-snug text-neutral-500">{description}</span>
        </div>
        <OpenBadge />
      </div>
      <div className="mt-auto pt-6">
        <MeshIllustration />
      </div>
    </Link>
  );
}
