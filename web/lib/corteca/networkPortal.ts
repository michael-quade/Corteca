// Corteca's "network portal" API (the console's radio management / WiFi point location calls),
// on its own host next to the l1 API: https://networkportal.<env>.homewifi.nokia.com.
// Worked out from the console's own code (2026-11-17, demo2) — not in Nokia's API docs.
// Read-only use only: this dashboard never writes locations to Corteca.
// - Authorization is the same Corteca access token **without** "Bearer ".
// - X-REALM-ID is the token's Keycloak realm (iss …/realms/<realm>); without it every call is 417.
// - Content-Type: application/json is sent on every call, GETs included (unlike ouife).
// - A WiFi point's record id = last 12 characters of the cluster id + the MAC without separators.

import { cortecaFetch } from './cortecaFetch';

export function networkPortalBase(): string | null {
  if (process.env.CORTECA_NETWORK_PORTAL_URL) return process.env.CORTECA_NETWORK_PORTAL_URL.replace(/\/$/, '');
  const l1 = process.env.CORTECA_API_BASE_URL;
  if (!l1 || !/\/\/l1api\./.test(l1)) return null;
  return l1.replace('//l1api.', '//networkportal.').replace(/\/$/, '');
}

/** The Keycloak realm from the access token's issuer. */
export function tokenRealm(token: string): string | null {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { iss?: unknown };
    const m = typeof claims.iss === 'string' ? /\/realms\/([^/]+)/.exec(claims.iss) : null;
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function networkPortalFetch(token: string, path: string, init: { method?: string; body?: unknown } = {}, timeoutMs = 20_000) {
  const base = networkPortalBase();
  const realm = tokenRealm(token);
  if (!base || !realm) throw new Error('Network portal not configured');
  return cortecaFetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-REALM-ID': realm,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }, timeoutMs);
}

/** `14-55-B9-6D-66-80` → `14:55:b9:6d:66:80` (the network portal's spelling). */
export const portalMac = (mac: string) => mac.replace(/-/g, ':').toLowerCase();

const recordId = (clusterId: string, mac: string) => clusterId.slice(-12) + mac.replace(/[^a-z0-9]/gi, '').toLowerCase();

export interface PortalLocation { latitude: number; longitude: number; locType?: number; accuracy?: number }

export interface PortalAp {
  clusterId: string;
  /** The gateway's record id (from its primary MAC) — the console's `apId`. */
  apId: string;
  primMac: string;
  loc: PortalLocation | null;
  zoneTag: string | null;
}

/** Finds a gateway's WiFi point record (tries each cluster the user can see). */
export async function findPortalAp(token: string, mac: string): Promise<PortalAp | null> {
  const res = await networkPortalFetch(token, '/cluster');
  if (!res.ok) throw new Error(`Network portal clusters unavailable (HTTP ${res.status})`);
  const clusters = (await res.json().catch(() => [])) as { id?: unknown }[];
  const pm = portalMac(mac);
  for (const c of Array.isArray(clusters) ? clusters : []) {
    if (typeof c?.id !== 'string') continue;
    const apId = recordId(c.id, pm);
    const r = await networkPortalFetch(token, `/ap/${apId}/one`);
    if (!r.ok) continue;
    const d = (await r.json().catch(() => null)) as {
      primMacAddress?: string;
      info?: { loc?: PortalLocation; zoneTag?: string };
    } | null;
    if (!d) continue;
    const loc = d.info?.loc;
    return {
      clusterId: c.id,
      apId,
      primMac: d.primMacAddress ?? pm,
      loc: loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number' ? loc : null,
      zoneTag: d.info?.zoneTag ?? null,
    };
  }
  return null;
}

/**
 * The console's "Autodetect location": Corteca looks the WiFi point up (Google geolocation from
 * the networks it sees). Read-only — nothing is stored until a separate save.
 */
export async function detectLocation(token: string, ap: PortalAp): Promise<{ lat: number; lng: number; accuracy: number | null } | null> {
  const r = await networkPortalFetch(token, `/location/${ap.clusterId}/ap/${ap.primMac}`, {}, 30_000);
  if (!r.ok) throw new Error(`Location detection failed (HTTP ${r.status})`);
  const d = (await r.json().catch(() => null)) as { location?: { lat?: number; lng?: number } | null; accuracy?: number } | null;
  const l = d?.location;
  if (!l || typeof l.lat !== 'number' || typeof l.lng !== 'number') return null;
  return { lat: l.lat, lng: l.lng, accuracy: typeof d?.accuracy === 'number' ? d.accuracy : null };
}
