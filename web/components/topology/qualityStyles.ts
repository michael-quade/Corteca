import type { Quality } from "@/web/lib/topologyFlow";

// One three-step status scale shared by links, client signal dots and the legend.
export const QUALITY_STROKE: Record<Quality, string> = {
  good: "stroke-emerald-500",
  fair: "stroke-amber-500",
  poor: "stroke-red-500",
  unknown: "stroke-neutral-400",
};

export const QUALITY_BG: Record<Quality, string> = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-red-500",
  unknown: "bg-neutral-300",
};

export const QUALITY_BORDER: Record<Quality, string> = {
  good: "border-emerald-300 text-emerald-800",
  fair: "border-amber-300 text-amber-800",
  poor: "border-red-300 text-red-700",
  unknown: "border-neutral-300 text-neutral-600",
};

export const QUALITY_LABEL: Record<Quality, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unknown: "Unknown",
};
