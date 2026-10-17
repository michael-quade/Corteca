// Alarm severities and their Corteca-style pill colours.

export const SEVERITIES = ["critical", "major", "minor", "clear"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Query toggles: pastel when off, solid when selected (data-checked). */
export const SEVERITY_TOGGLE: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 text-red-700 data-[checked]:border-red-600 data-[checked]:bg-red-600 data-[checked]:text-white",
  major:    "border-orange-200 bg-orange-50 text-orange-700 data-[checked]:border-orange-500 data-[checked]:bg-orange-500 data-[checked]:text-white",
  minor:    "border-yellow-200 bg-yellow-50 text-yellow-800 data-[checked]:border-yellow-500 data-[checked]:bg-yellow-500 data-[checked]:text-white",
  clear:    "border-emerald-200 bg-emerald-50 text-emerald-800 data-[checked]:border-emerald-600 data-[checked]:bg-emerald-600 data-[checked]:text-white",
};

/** Result count pills. */
export const SEVERITY_PILL: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  major:    "bg-orange-100 text-orange-700",
  minor:    "bg-yellow-100 text-yellow-800",
  clear:    "bg-emerald-100 text-emerald-800",
};

export const SEVERITY_ORDER = ["critical", "major", "minor", "clear"];
