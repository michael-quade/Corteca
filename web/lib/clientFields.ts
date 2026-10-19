// Client fields shared by the topology canvas, panels and filters (band, signal, name).

import type { Member } from "@/web/lib/corteca/types";
import type { Band, Quality } from "@/web/lib/topologyFlow";

export function clientBand(m: Member): Band {
  if (String(m.type ?? "").toLowerCase() === "ethernet") return "Wired";
  const f = Number(m.frequency ?? 0);
  if (f >= 2400 && f < 2500) return "2.4 GHz";
  if (f >= 4900 && f < 5900) return "5 GHz";
  if (f >= 5925) return "6 GHz";
  return "Other";
}

export const isWired = (m: Member) => String(m.type ?? "").toLowerCase() === "ethernet";

export function clientSignalDbm(m: Member): number | null {
  if (isWired(m)) return null;
  const s = Number((m as unknown as { signal?: number }).signal ?? m.rssi);
  return Number.isFinite(s) && s !== 0 ? s : null;
}

// Client signal uses the same three-step scale as the links.
export function clientSignal(m: Member): Quality | null {
  if (isWired(m)) return null;
  const s = clientSignalDbm(m);
  if (s == null) return "unknown";
  return s >= -65 ? "good" : s >= -75 ? "fair" : "poor";
}

export function clientName(m: Member): string {
  const host = (m as unknown as { hostname?: string }).hostname;
  return (m.alias || host || m.id).trim();
}

