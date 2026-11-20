import type { GatewayKind } from "@/web/lib/homeApStats";

/**
 * Gateway-type colours for the Network Map's "WiFi devices per home" card. Beacon / ONT / fixed
 * wireless are categorical slots 1–3 (validated all-pairs: worst CVD ΔE 9.2, normal 24.0; the aqua
 * is under 3:1 on white, so every segment has a labelled legend row). Other / Unknown are greys,
 * always with a text label.
 */
export const GATEWAY_COLOR: Record<GatewayKind, string> = {
  beacon: "#2a78d6",
  ont: "#eb6834",
  fwa: "#1baf7a",
  other: "#a3a3a3",
  unknown: "#d4d4d4",
};
