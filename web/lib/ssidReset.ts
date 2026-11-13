// Server only. Operator / app requests (POST_DEVICEHUB_DEVICES_ROUTER_ITEM) carry a raw
// request in `data.payload`, which sanitiseEventData() drops. Before that, flag the ones
// that set the WiFi password with `data.ssid_reset = "true"` so the TDS events popout can
// show "Main WiFi password set" (P2). Only the flag leaves the server, never the payload.
//
// Seen on demo2 (2026-11-13, 69 of 69 such requests): a form-encoded, Java-map-like string
// `{…, data={act=ConfigWhwPswd&wl_ssid=…&pswdNew=&wpaKey=…}, method=POST,
// resource=whw_onboarding_app.cgi, …}` — Corteca already blanks the password fields, so
// the `act` names the change. A filled password field counts too.

const ACTION = /\bact=ConfigWhwPswd\b/;
const FILLED_STRING = /\b(pswdNew|wpaKey)=(?!null\b)[^,&}\s]/;
const PASSWORD_KEY = /^(pswdNew|wpaKey)$/;
const MAX_DEPTH = 6;

function setsWifiPassword(v: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH || v == null) return false;
  if (typeof v === "string") {
    if (ACTION.test(v) || FILLED_STRING.test(v)) return true;
    const s = v.trim();
    if (!s.startsWith("{") && !s.startsWith("[")) return false;
    try { return setsWifiPassword(JSON.parse(s), depth + 1); } catch { return false; }
  }
  if (Array.isArray(v)) return v.some((x) => setsWifiPassword(x, depth + 1));
  if (typeof v !== "object") return false;
  return Object.entries(v as Record<string, unknown>).some(([k, x]) =>
    (k === "act" && x === "ConfigWhwPswd")
    || (PASSWORD_KEY.test(k) && typeof x === "string" && x.trim() !== "")
    || setsWifiPassword(x, depth + 1));
}

/** Adds `data.ssid_reset = "true"` to raw activity rows whose payload sets the WiFi password. */
export function markSsidResets(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const r = row as Record<string, unknown>;
    const data = r.data;
    if (!data || typeof data !== "object" || !setsWifiPassword((data as Record<string, unknown>).payload)) return row;
    return { ...r, data: { ...(data as Record<string, unknown>), ssid_reset: "true" } };
  });
}
