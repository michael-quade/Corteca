/**
 * "Noisy devices": a device whose count is more than `factor` × the next device's is set
 * aside so it doesn't flatten every other bar (demo2: one FastMile 5G Gateway 3.2 had 70,557
 * cloud disconnections in 7 days, the next device 318). Applied repeatedly from the top, so
 * two runaway devices both go. factor ≤ 0 = off.
 */
export interface SetAside<T> { item: T; value: number; ratio: number }

export function splitNoisy<T>(items: T[], valueOf: (t: T) => number, factor: number): { kept: T[]; setAside: SetAside<T>[] } {
  const sorted = [...items].sort((a, b) => valueOf(b) - valueOf(a));
  const setAside: SetAside<T>[] = [];
  if (factor > 0) {
    while (sorted.length >= 2) {
      const top = valueOf(sorted[0]);
      const next = valueOf(sorted[1]);
      if (next <= 0 || top <= factor * next) break;
      setAside.push({ item: sorted[0], value: top, ratio: top / next });
      sorted.shift();
    }
  }
  return { kept: sorted, setAside };
}

/** Parses a factor typed by the user: a whole number ≥ 0, or null when it isn't one. */
export function parseNoisyFactor(v: string | null | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
