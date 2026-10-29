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
