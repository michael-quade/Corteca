/**
 * Fleet inventory (Fleet Metrics → Inventory) from three Corteca reads, summarised server-side:
 * - `/device-management/stats`: online / offline per model. A model can appear twice (managed
 *   and unmanaged entries), so counts are summed per model; entries without a model are
 *   "No model reported".
 * - `/device-management/reports/devicestatus/download?online=False`: every offline WiFi point
 *   with its `Last offline` time (ISO) → how long offline devices have been gone.
 * - `/device-management/firmwares`: the firmware versions seen per model.
 */

export interface ModelStatus {
  model: string;
  online: number;
  offline: number;
  /** Offline devices last seen more than a year ago (from the device-status CSV). */
  offlineOverYear: number;
}

export interface AgeBucket { id: string; label: string; count: number }

export interface InventoryResponse {
  totals: { managed: number; online: number; offline: number; offlineOverYear: number; provisioned: number | null };
  models: ModelStatus[];
  offlineAge: AgeBucket[];
  firmware: { model: string; versions: number }[];
  readAt: string;
  warnings: string[];
}

const NO_MODEL = "No model reported";
const DAY = 86_400_000;

const AGE_BUCKETS: { id: string; label: string; maxDays: number }[] = [
  { id: "1d", label: "< 1 day", maxDays: 1 },
  { id: "7d", label: "1–7 days", maxDays: 7 },
  { id: "30d", label: "1–4 weeks", maxDays: 30 },
  { id: "1y", label: "1–12 months", maxDays: 365 },
  { id: "2y", label: "1–2 years", maxDays: 730 },
  { id: "old", label: "> 2 years", maxDays: Infinity },
];

export function summariseStats(raw: unknown): Map<string, { online: number; offline: number }> {
  const out = new Map<string, { online: number; offline: number }>();
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const model = typeof o.model === "string" && o.model.trim() ? o.model.trim() : NO_MODEL;
    const cur = out.get(model) ?? { online: 0, offline: 0 };
    cur.online += Number(o.online_count) || 0;
    cur.offline += Number(o.offline_count) || 0;
    out.set(model, cur);
  }
  return out;
}

/** Offline devices by time since `Last offline`, plus per-model counts of those gone over a year. */
export function offlineAges(rows: Record<string, string>[], now = Date.now()): { buckets: AgeBucket[]; overYearByModel: Map<string, number>; never: number } {
  const counts = new Map(AGE_BUCKETS.map((b) => [b.id, 0]));
  const overYearByModel = new Map<string, number>();
  let never = 0;
  for (const r of rows) {
    const t = Date.parse(r["Last offline"] ?? "");
    if (!Number.isFinite(t)) { never++; continue; }
    const days = (now - t) / DAY;
    const bucket = AGE_BUCKETS.find((b) => days < b.maxDays) ?? AGE_BUCKETS[AGE_BUCKETS.length - 1];
    counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + 1);
    if (days >= 365) {
      const model = r["Model Name"]?.trim() || NO_MODEL;
      overYearByModel.set(model, (overYearByModel.get(model) ?? 0) + 1);
    }
  }
  return { buckets: AGE_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: counts.get(b.id) ?? 0 })), overYearByModel, never };
}

export function firmwareSpread(raw: unknown): { model: string; versions: number }[] {
  const byModel = new Map<string, Set<string>>();
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      if (typeof o.model !== "string" || !Array.isArray(o.firmwares)) continue;
      const set = byModel.get(o.model) ?? new Set<string>();
      for (const f of o.firmwares) if (typeof f === "string" && f) set.add(f);
      byModel.set(o.model, set);
    }
  }
  return [...byModel].map(([model, s]) => ({ model, versions: s.size })).filter((m) => m.versions > 0).sort((a, b) => b.versions - a.versions);
}

export function buildInventory(stats: unknown, offlineRows: Record<string, string>[] | null, firmwares: unknown, provisioned: number | null, warnings: string[]): InventoryResponse {
  const perModel = summariseStats(stats);
  const ages = offlineRows ? offlineAges(offlineRows) : null;
  const models: ModelStatus[] = [...perModel].map(([model, c]) => ({
    model, online: c.online, offline: c.offline,
    offlineOverYear: Math.min(c.offline, ages?.overYearByModel.get(model) ?? 0),
  })).sort((a, b) => b.online + b.offline - (a.online + a.offline));
  const sum = (f: (m: ModelStatus) => number) => models.reduce((a, m) => a + f(m), 0);
  const online = sum((m) => m.online);
  const offline = sum((m) => m.offline);
  return {
    totals: { managed: online + offline, online, offline, offlineOverYear: sum((m) => m.offlineOverYear), provisioned },
    models,
    offlineAge: ages ? [...ages.buckets, ...(ages.never ? [{ id: "never", label: "No time", count: ages.never }] : [])] : [],
    firmware: firmwareSpread(firmwares),
    readAt: new Date().toISOString(),
    warnings,
  };
}
