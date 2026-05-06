export type Continent = "Africa" | "Antarctica" | "Asia" | "Europe" | "North America" | "Oceania" | "South America";

export function continentFromLatLng(lat: number, lng: number): Continent | null {
  if (lat <= -60) return "Antarctica";
  // Africa: lat -35..37, lng -20..55
  if (lat >= -35 && lat <= 37 && lng >= -20 && lng <= 55) return "Africa";
  // Europe: lat 35..75, lng -25..50
  if (lat >= 35 && lat <= 75 && lng >= -25 && lng <= 50) return "Europe";
  // South America: lat -56..15, lng -85..-34
  if (lat >= -56 && lat <= 15 && lng >= -85 && lng <= -34) return "South America";
  // North America: lat 5..85, lng -170..-52
  if (lat >= 5 && lat <= 85 && lng >= -170 && lng <= -52) return "North America";
  // Oceania: lat -50..0, lng 110..180
  if (lat >= -50 && lat <= 0 && lng >= 110 && lng <= 180) return "Oceania";
  // Oceania Pacific islands: lat -50..25, lng 150..180 or -180..-130
  if (lat >= -50 && lat <= 25 && lng >= -180 && lng <= -130) return "Oceania";
  // Asia: everything remaining in Eastern hemisphere + SE Asia
  if (lat >= -10 && lat <= 80 && lng >= 25 && lng <= 180) return "Asia";
  return null;
}

export interface CachedMarker {
  mac: string;
  lat: number;
  lng: number;
  online: boolean;
  model: string;
  firmware: string;
  customerId: string;
  accountName: string;
  country: string;
  continent: Continent | null;
}

const CACHE_KEY  = "corteca:markers:v2";
const NAMES_KEY  = "corteca:names:v4";

export function loadMarkerCache(): Map<string, CachedMarker> {
  if (typeof localStorage === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as CachedMarker[];
    return new Map(arr.map((m) => [m.mac, m]));
  } catch { return new Map(); }
}

export function saveMarkerCache(markers: Map<string, CachedMarker>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify([...markers.values()]));
  } catch { /* ignore quota errors */ }
}

export function clearMarkerCache(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* */ }
}

// ── Account name cache (all devices, online + offline) ────────────────────────

export function loadNameCache(): Map<string, string> {
  if (typeof localStorage === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
  } catch { return new Map(); }
}

export function saveNameCache(names: Map<string, string>): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(Object.fromEntries(names))); } catch { /* */ }
}

export function clearNameClientCache(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(NAMES_KEY); } catch { /* */ }
}
