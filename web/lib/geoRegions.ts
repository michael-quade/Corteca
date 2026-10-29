// Server only: continent, country and (US / Canada) state or province for a point, offline.
// Countries from @rapideditor/country-coder; states / provinces from Natural Earth 1:50m
// admin-1 boundaries (web/lib/geo/us-ca-admin1.json, coordinates rounded to 0.01°).

import { feature, featuresContaining } from "@rapideditor/country-coder";
import admin1 from "@/web/lib/geo/us-ca-admin1.json";
import type { GeoRegion } from "@/web/lib/regionFilter";

type Ring = number[][];
interface Admin1 { c: string; code: string; name: string; p: Ring[][]; bbox?: [number, number, number, number] }

const STATES = admin1 as Admin1[];
for (const s of STATES) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  for (const poly of s.p) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  s.bbox = [x0, y0, x1, y1];
}

// UN M49 groups country-coder returns; North / South America split the Americas (019).
const CONTINENTS: [string, string][] = [
  ["003", "North America"], ["005", "South America"], ["150", "Europe"], ["142", "Asia"],
  ["002", "Africa"], ["009", "Oceania"], ["010", "Antarctica"], ["019", "South America"],
];

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inPoly = (x: number, y: number, poly: Ring[]) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h));

/** Squared distance (degrees, longitude scaled by latitude) from a point to a state's outline. */
function distance2(x: number, y: number, s: Admin1): number {
  const k = Math.cos((y * Math.PI) / 180);
  let best = Infinity;
  for (const poly of s.p) for (const ring of poly) for (let i = 1; i < ring.length; i++) {
    const ax = ring[i - 1][0] * k, ay = ring[i - 1][1], bx = ring[i][0] * k, by = ring[i][1], px = x * k;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (y - ay) * dy) / len)) : 0;
    best = Math.min(best, (px - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2);
  }
  return best;
}

const NEAR2 = 0.5 ** 2; // a point within ~50 km of a border (coast, rounded outline) still counts

function subdivision(lng: number, lat: number, country: string | null): Admin1 | null {
  const candidates = STATES.filter((s) => !country || s.c === country);
  const hit = candidates.find((s) => {
    const [x0, y0, x1, y1] = s.bbox!;
    return lng >= x0 && lng <= x1 && lat >= y0 && lat <= y1 && s.p.some((poly) => inPoly(lng, lat, poly));
  });
  if (hit) return hit;
  let best: Admin1 | null = null, bestD = NEAR2;
  for (const s of candidates) {
    const [x0, y0, x1, y1] = s.bbox!;
    if (lng < x0 - 1 || lng > x1 + 1 || lat < y0 - 1 || lat > y1 + 1) continue;
    const d = distance2(lng, lat, s);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

const COUNTRY_NAMES: Record<string, string> = { US: "United States", CA: "Canada" };
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Everyday English name ("Netherlands", not country-coder's "Kingdom of the Netherlands"). */
function countryName(code: string, fallback?: string): string {
  try { return COUNTRY_NAMES[code] ?? displayNames.of(code) ?? fallback ?? code; } catch { return fallback ?? code; }
}

const cache = new Map<string, GeoRegion>();

export function regionOf(lat: number, lng: number): GeoRegion {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const loc: [number, number] = [lng, lat];
  const f = feature(loc, { level: "country" });
  let countryCode = f?.properties.iso1A2 ?? null;
  let country = countryCode ? countryName(countryCode, f?.properties.nameEn) : null;
  const containing = featuresContaining(loc);
  const groups = new Set(containing.map((g) => g.properties.id));
  let continent = CONTINENTS.find(([id]) => groups.has(id))?.[1] ?? null;

  let regionCode: string | null = null, region: string | null = null;
  if (!countryCode || countryCode === "US" || countryCode === "CA") {
    const s = subdivision(lng, lat, countryCode);
    if (s) {
      regionCode = `${s.c}-${s.code}`;
      region = s.name;
      // Just offshore: country-coder found nothing, the nearest state settles it.
      if (!countryCode) {
        countryCode = s.c;
        country = countryName(s.c);
      }
    } else if (countryCode === "US") {
      // Territories (Puerto Rico, Guam, …): the territory stands in for the state.
      const t = containing.find((g) => g.properties.level === "territory" && g.properties.iso1A2);
      if (t) { regionCode = `US-${t.properties.iso1A2}`; region = t.properties.nameEn; }
    }
  }
  // Hawaii is Oceania by UN grouping; operators think of the US and Canada as North America.
  if (countryCode === "US" || countryCode === "CA") continent = "North America";

  const r = { continent, countryCode, country, regionCode, region };
  cache.set(key, r);
  return r;
}
