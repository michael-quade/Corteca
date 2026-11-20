/**
 * Corteca's report rankings (`/measures/reports/types/{type}/ranking`): the worst 100
 * devices / networks of a daily report type over a date range. Checked on demo2 2026-11-20:
 * reboot, cloud_disconnection, noise, obss and coverage answer; backhaul is empty; claim,
 * new_device and shaped_event return 500. Paging is ignored (page 1 repeats page 0), so one
 * call gives everything there is.
 */

export const RANKING_TYPES = ["reboot", "cloud_disconnection", "coverage", "noise", "obss"] as const;
export type RankingType = (typeof RANKING_TYPES)[number];

export function isRankingType(v: string): v is RankingType {
  return (RANKING_TYPES as readonly string[]).includes(v);
}

/** One ranked row, normalised. Fields a type doesn't have stay undefined. */
export interface RankingRow {
  rank: number;
  /** Device MAC (reboot, cloud_disconnection, noise, obss); coverage has only the network. */
  deviceId?: string;
  /** Home network (root MAC) — noise, obss, coverage. */
  networkId?: string;
  model: string;
  subscriberId?: string;
  /** Events (reboot / disconnection) or samples (noise / obss / coverage) in the range. */
  count: number;
  /** Channel centre frequency, MHz (noise / obss / coverage). */
  frequency?: number;
  /** noise: average dBm · obss: average % airtime from other networks · coverage: average client RSSI dBm. */
  avg?: number;
  worst?: number;
  /** coverage only. */
  affectedMetric?: number;
  affectedPct?: number;
  stations?: number;
}

export interface RankingResponse {
  type: RankingType;
  from: string;
  to: string;
  rows: RankingRow[];
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseRanking(raw: unknown): RankingRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): RankingRow[] => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const deviceId = str(o.device_id);
    const networkId = str(o.network_id);
    if (!deviceId && !networkId) return [];
    return [{
      rank: num(o.rank) ?? 0,
      deviceId, networkId,
      model: str(o.model) ?? "",
      subscriberId: str(o.subscriberId),
      count: num(o.count) ?? 0,
      frequency: num(o.frequency),
      avg: num(o.avg),
      worst: num(o.worst),
      affectedMetric: num(o.affected_metric),
      affectedPct: num(o.average_affected_perc),
      stations: num(o.num_stations),
    }];
  }).sort((a, b) => a.rank - b.rank);
}

/** A row's key for React lists (a device can appear once per band). */
export function rankingKey(r: RankingRow): string {
  return `${r.deviceId ?? r.networkId}:${r.frequency ?? ""}:${r.rank}`;
}
