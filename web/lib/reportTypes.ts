export interface ReportTypeConfig {
  /** Corteca API "type" values to match against — first match wins */
  cortecaTypes: string[];
  displayName: string;
  description: string;
  /** Field-name substrings (priority order) for the secondary grouping chart */
  groupByHints: string[];
  /** Hex color used for chart bars */
  color: string;
}

export const REPORT_CONFIGS: Record<string, ReportTypeConfig> = {
  reboot: {
    cortecaTypes: ["reboot"],
    displayName: "Reboot Report",
    description: "Device reboot events across all subscriber networks.",
    groupByHints: ["origin", "source", "trigger", "reason", "cause"],
    color: "#3b82f6",
  },
  congestion: {
    cortecaTypes: ["obss", "congestion", "obss_event", "shaped_event"],
    displayName: "Congestion (OBSS)",
    description: "Overlapping BSS congestion and channel interference events.",
    groupByHints: ["channel", "band", "frequency", "ap_id", "device_id"],
    color: "#ef4444",
  },
  noise: {
    cortecaTypes: ["noise", "noise_event", "noise_floor"],
    displayName: "Noise Report",
    description: "WiFi noise floor measurements and interference across network devices.",
    groupByHints: ["band", "channel", "frequency", "noise_level", "device_id"],
    color: "#f97316",
  },
  "new-devices": {
    cortecaTypes: ["new_network_device", "new_device", "device_added", "new_network"],
    displayName: "New Network Devices",
    description: "Newly discovered and connected devices across subscriber networks.",
    groupByHints: ["device_type", "type", "manufacturer", "os", "vendor"],
    color: "#10b981",
  },
  coverage: {
    cortecaTypes: ["coverage", "coverage_event", "coverage_issue"],
    displayName: "Coverage Report",
    description: "WiFi coverage quality scores and signal strength across the fleet.",
    groupByHints: ["coverage_level", "score_range", "status", "band", "device_id"],
    color: "#8b5cf6",
  },
  "cloud-disconnections": {
    cortecaTypes: ["cloud_disconnect", "cloud_disconnection", "disconnection", "disconnect"],
    displayName: "Cloud Disconnections",
    description: "Device cloud connectivity loss events and durations.",
    groupByHints: ["reason", "cause", "origin", "disconnect_type", "status"],
    color: "#64748b",
  },
  claim: {
    cortecaTypes: ["claim", "device_claim", "onboarding", "claim_event"],
    displayName: "Claim Report",
    description: "Device claim and subscriber onboarding events.",
    groupByHints: ["status", "result", "claim_status", "type", "origin"],
    color: "#06b6d4",
  },
  "backhaul-quality": {
    cortecaTypes: ["backhaul_quality", "backhaul", "backhaul_event", "mesh_backhaul"],
    displayName: "Backhaul Quality",
    description: "Mesh backhaul link quality and PHY rate measurements.",
    groupByHints: ["medium", "link_type", "quality_level", "band", "status"],
    color: "#d946ef",
  },
};
