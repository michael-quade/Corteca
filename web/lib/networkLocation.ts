// The gateway's position from Corteca's device summary (`/ouife/devices/{mac}/summary`).
// Only the gateway is located; Beacons have no position of their own.

export interface LatLng { lat: number; lng: number }

/** Reads lat/lng from a device summary, whichever key names it uses; null when absent or 0,0. */
export function extractLatLng(summary: unknown): LatLng | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const n = (v: unknown) => { const x = Number(v); return v === null || v === undefined || v === "" || isNaN(x) ? undefined : x; };

  let lat = n(s.latitude ?? s.lat ?? s.Latitude);
  let lng = n(s.longitude ?? s.lng ?? s.lon ?? s.Longitude);

  if (lat === undefined || lng === undefined) {
    const loc = s.location ?? s.coordinates ?? s.gps ?? s.address;
    if (loc && typeof loc === "object") {
      const l = loc as Record<string, unknown>;
      lat = n(l.latitude ?? l.lat);
      lng = n(l.longitude ?? l.lng ?? l.lon);
    }
  }

  if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** OpenStreetMap at this position, for an "open the full map" link. */
export function osmUrl({ lat, lng }: LatLng, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
