/** Display helpers shared by the Fleet Metrics views. */

/**
 * Corteca's reports spell one model several ways ("NOKIA_BEACON_6", "BEACON 6 HA-0336G-A",
 * "Nokia WiFi Beacon 6"). Upper-case underscore names become "Beacon 6"; others are kept.
 */
export function prettyModel(model: string | undefined | null): string {
  const m = (model ?? "").trim();
  if (!m) return "Unknown model";
  const under = m.match(/^NOKIA_BEACON_([\w.]+)$/i);
  if (under) return `Beacon ${under[1]}`;
  return m;
}

/** WiFi channel centre frequency (MHz) → "2.4 GHz · Ch 1" / "5 GHz · Ch 36" / "6 GHz · Ch 37". */
export function bandChannel(freq: number | undefined): string {
  if (!freq || !Number.isFinite(freq)) return "—";
  if (freq >= 2400 && freq < 2500) return `2.4 GHz · Ch ${freq === 2484 ? 14 : Math.round((freq - 2407) / 5)}`;
  if (freq >= 5925 && freq < 7200) return `6 GHz · Ch ${Math.round((freq - 5950) / 5)}`;
  if (freq >= 4900 && freq < 5925) return `5 GHz · Ch ${Math.round((freq - 5000) / 5)}`;
  return `${freq} MHz`;
}

export function bandOf(freq: number | undefined): "2.4 GHz" | "5 GHz" | "6 GHz" | "Other" {
  if (!freq) return "Other";
  if (freq < 2500) return "2.4 GHz";
  if (freq >= 5925) return "6 GHz";
  if (freq >= 4900) return "5 GHz";
  return "Other";
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function pctOf(part: number, whole: number, digits = 1): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(digits)}%` : "—";
}
