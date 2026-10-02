// Shared (client + server) — WiFi generation tags for Beacon models in the SW Release Matrix.

export const WIFI_GENERATIONS = ['WiFi 5', 'WiFi 6/6E', 'WiFi 7'] as const;

export type WifiGeneration = (typeof WIFI_GENERATIONS)[number];

/** Beacon model name → WiFi generation. Models without an entry are untagged. */
export type ModelWifiMap = Record<string, WifiGeneration>;

export function isWifiGeneration(value: unknown): value is WifiGeneration {
  return typeof value === 'string' && (WIFI_GENERATIONS as readonly string[]).includes(value);
}

/** Drops entries for models not in the list and entries with an unknown generation. */
export function sanitizeModelWifi(raw: unknown, beaconModels: string[]): ModelWifiMap {
  const result: ModelWifiMap = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const model of beaconModels) {
    const gen = (raw as Record<string, unknown>)[model];
    if (isWifiGeneration(gen)) result[model] = gen;
  }
  return result;
}
