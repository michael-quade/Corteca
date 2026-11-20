/**
 * Onboarding & apps (read-only): failed subscriber claims (`/subscribers/failed_claims`),
 * WiFi points waiting to be claimed (`/subscribers/claimable_devices`), WiFi points refused by
 * provisioning (`/device-provisioning/failed_devices`), and container apps
 * (`/container-management/containers` + per app `/counts` and daily `/trends`).
 */

export interface FailedClaim { subscriberId: string; attempts: number; first: string; last: string }
export interface Claimable { deviceId: string; claimTypes: string }
export interface Unauthenticated { mac: string; firstSeen: string; ip: string }
export interface AppRow {
  uuid: string;
  name: string;
  categories: string;
  status: string;
  versions: string[];
  latest: string;
  installed: number | null;
  uninstalled: number | null;
  /** In the selected range, from the daily trend. */
  installs: number;
  failures: number;
  removals: number;
}

export interface OnboardingResponse {
  failedClaims: FailedClaim[];
  claimable: Claimable[];
  claimableCapped: boolean;
  unauthenticated: Unauthenticated[];
  unauthenticatedCapped: boolean;
  apps: AppRow[];
  errors: string[];
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function parseFailedClaims(raw: unknown[]): FailedClaim[] {
  return raw.flatMap((e) => {
    const o = e as { subscriber_id?: unknown; failed_attempt_count?: unknown; claims?: unknown };
    const times = (Array.isArray(o.claims) ? o.claims : []).map((c) => s((c as { timestamp?: unknown }).timestamp)).filter(Boolean).sort();
    if (!o.subscriber_id) return [];
    return [{ subscriberId: s(o.subscriber_id), attempts: Number(o.failed_attempt_count) || times.length, first: times[0] ?? "", last: times[times.length - 1] ?? "" }];
  }).sort((a, b) => b.last.localeCompare(a.last));
}

export function parseClaimable(raw: unknown[]): Claimable[] {
  return raw.flatMap((e) => {
    const o = e as { device_id?: unknown; claims?: unknown };
    if (!o.device_id) return [];
    const types = [...new Set((Array.isArray(o.claims) ? o.claims : []).map((c) => s((c as { claim_type?: unknown }).claim_type)).filter(Boolean))];
    return [{ deviceId: s(o.device_id), claimTypes: types.join(", ") }];
  });
}

export function parseUnauthenticated(raw: unknown[]): Unauthenticated[] {
  return raw.flatMap((e) => {
    const o = e as { client_id?: unknown; user_name?: unknown; created_at?: unknown; ip?: unknown };
    const mac = s(o.client_id || o.user_name);
    return mac ? [{ mac, firstSeen: s(o.created_at), ip: s(o.ip) }] : [];
  }).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
}

/** Containers come one entry per app version; grouped per app uuid. */
export function groupApps(raw: unknown[]): Omit<AppRow, "installed" | "uninstalled" | "installs" | "failures" | "removals">[] {
  const apps = new Map<string, Omit<AppRow, "installed" | "uninstalled" | "installs" | "failures" | "removals">>();
  for (const e of raw) {
    const o = e as Record<string, unknown>;
    const uuid = s(o.uuid);
    if (!uuid) continue;
    const loc = Array.isArray(o.localization) ? (o.localization[0] as { name?: unknown } | undefined) : undefined;
    const cur = apps.get(uuid) ?? {
      uuid, name: s(loc?.name) || uuid, categories: (Array.isArray(o.category) ? o.category.map(s) : [s(o.category)]).filter(Boolean).join(", "),
      status: s(o.status), versions: [], latest: "",
    };
    const v = s(o.version);
    if (v && !cur.versions.includes(v)) cur.versions.push(v);
    if (o.latest === true && v) { cur.latest = v; cur.status = s(o.status) || cur.status; }
    apps.set(uuid, cur);
  }
  return [...apps.values()].map((a) => ({ ...a, latest: a.latest || a.versions[a.versions.length - 1] || "" }));
}

/** Daily trend → installs / failures / removals since `sinceDay` (yyyy-mm-dd). */
export function appActivity(raw: unknown, sinceDay: string): { installs: number; failures: number; removals: number } {
  const out = { installs: 0, failures: 0, removals: 0 };
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    const o = e as { date?: unknown; stats?: unknown; device_removed_count?: unknown; factory_reset_count?: unknown };
    if (s(o.date) < sinceDay) continue;
    out.removals += (Number(o.device_removed_count) || 0) + (Number(o.factory_reset_count) || 0);
    for (const st of Array.isArray(o.stats) ? o.stats as { code?: unknown; count?: unknown; operation?: unknown; message?: unknown }[] : []) {
      const n = Number(st.count) || 0;
      if (Number(st.code) !== 0) out.failures += n;
      else if (s(st.operation) === "Install" && s(st.message) === "Success") out.installs += n;
    }
  }
  return out;
}
