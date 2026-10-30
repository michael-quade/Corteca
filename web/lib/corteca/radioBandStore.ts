// Server-side store of WiFi radio bands per device model (RadioBands table + memory). Written
// when an online AP reports its radios (MCP / REST network reads); read by the MCP visualizer
// for APs that report none (offline). DB failures fall back to what this process has learned.

import { displayModel, modelKey } from "@/web/lib/portLayouts";
import { isBandList, mergeBands, sameBands, type ModelBands } from "@/web/lib/radioBands";

const TTL_MS = 5 * 60_000;
// On globalThis so every route bundle in one server process shares what it learned (Next bundles
// API routes separately, so a module-level variable would be one copy per route).
const store = globalThis as unknown as { __radioBands?: { cache: { at: number; models: Map<string, ModelBands> } | null; dbDown: boolean } };
const state = (store.__radioBands ??= { cache: null, dbDown: false }); // dbDown: stop retrying writes (table not pushed yet / DB unreachable)

async function db() {
  return process.env.DATABASE_URL ? (await import("@/web/lib/prisma")).prisma : null;
}

export async function getModelBands(): Promise<ModelBands[]> {
  if (state.cache && Date.now() - state.cache.at < TTL_MS) return [...state.cache.models.values()];
  const models = new Map(state.cache?.models ?? []);
  const client = await db();
  let at = Date.now();
  if (client) {
    try {
      for (const r of await client.radioBands.findMany()) {
        if (!isBandList(r.bands)) continue;
        const known = models.get(r.model);
        models.set(r.model, { model: r.model, displayName: r.displayName, bands: known ? mergeBands(known.bands, r.bands) : r.bands, sampleMac: r.sampleMac, updatedAt: r.updatedAt.toISOString() });
      }
      state.dbDown = false;
    } catch (e) {
      console.warn("[radio-bands] DB read failed:", e instanceof Error ? e.message.split("\n")[0] : e);
      at -= TTL_MS - 60_000;
    }
  }
  state.cache = { at, models };
  return [...models.values()];
}

/** Add what online APs reported to their models' band lists (only writes when a list grows). */
export async function recordApBands(aps: { model: string; mac: string; bands: string[] }[]): Promise<void> {
  if (!aps.length) return;
  await getModelBands().catch(() => []);
  const changed: ModelBands[] = [];
  for (const ap of aps) {
    const key = modelKey(ap.model);
    if (!key) continue;
    const known = state.cache?.models.get(key);
    const bands = known ? mergeBands(known.bands, ap.bands) : ap.bands;
    if (known && sameBands(known.bands, bands)) continue;
    const entry = { model: key, displayName: displayModel(ap.model), bands, sampleMac: ap.mac, updatedAt: new Date().toISOString() };
    state.cache?.models.set(key, entry);
    changed.push(entry);
  }
  const client = await db();
  if (!client || state.dbDown || !changed.length) return;
  try {
    for (const m of changed) {
      const data = { displayName: m.displayName, bands: m.bands, sampleMac: m.sampleMac };
      await client.radioBands.upsert({ where: { model: m.model }, create: { model: m.model, ...data }, update: data });
      console.log(`[radio-bands] learned ${m.displayName}: ${m.bands.join(" · ")} (from ${m.sampleMac})`);
    }
  } catch (e) {
    state.dbDown = true;
    console.warn("[radio-bands] DB write failed (kept in memory):", e instanceof Error ? e.message.split("\n")[0] : e);
  }
}
