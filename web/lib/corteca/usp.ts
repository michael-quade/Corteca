import { lookupUspEndpointId, lookupUspEndpointIdBySerial } from '@/web/lib/corteca/reportCache';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

export interface SupportedParam {
  paramName: string;
  access: 'readOnly' | 'readWrite';
  valueType: string;
}

export interface SupportedObj {
  supportedObjPath: string;
  access: string;
  isMultiInstance: boolean;
  supportedParams: SupportedParam[];
}

// ── Endpoint ID resolution ────────────────────────────────────────────────────

export async function resolveUspEndpointId(
  deviceId: string,
  baseUrl: string,
  authHeaders: Record<string, string>,
): Promise<string> {
  const cached = lookupUspEndpointId(deviceId);
  if (cached) return cached;

  try {
    const res = await cortecaFetch(
      `${baseUrl}/device-management/devices/${deviceId}/config`,
      { headers: authHeaders },
    );
    if (res.ok) {
      const config = await res.json();
      const params = config?.params as Record<string, string> | undefined;
      if (params) {
        const oui    = params['Device.DeviceInfo.ManufacturerOUI'];
        const serial = params['Device.DeviceInfo.SerialNumber'];
        if (serial) {
          const fromReport = lookupUspEndpointIdBySerial(serial);
          if (fromReport) return fromReport;
          if (oui) return `os::${oui}-${serial}`;
          return serial;
        }
      }
    }
  } catch { /* fall through to MAC */ }

  return deviceId;
}

// ── USP REST POST ─────────────────────────────────────────────────────────────

export async function uspPost(
  baseUrl: string,
  endpointId: string,
  deviceMac: string,
  authHeaders: Record<string, string>,
  payload: unknown,
): Promise<{ ok: boolean; json: unknown; status: number }> {
  const url = `${baseUrl}/rest-usp/agents/${endpointId}/message?timeout=59&device_id=${deviceMac}`;
  try {
    const res = await cortecaFetch(url, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = text; }
    if (!res.ok) console.warn(`[USP] HTTP ${res.status} ${url}: ${text.slice(0, 200)}`);
    return { ok: res.ok, json, status: res.status };
  } catch (e) {
    console.error(`[USP] exception ${url}: ${e}`);
    return { ok: false, json: null, status: 0 };
  }
}

// ── Response parsers ──────────────────────────────────────────────────────────

// Parses USP GET_RESP → flat map of full param path → value
export function parseGetResp(body: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const getResp = ((body as Record<string, unknown>)?.response as Record<string, unknown>)
      ?.getResp as Record<string, unknown>;
    for (const pr of (getResp?.reqPathResults as unknown[]) ?? []) {
      for (const rr of ((pr as Record<string, unknown>).resolvedPathResults as unknown[]) ?? []) {
        const r = rr as Record<string, unknown>;
        const base = String(r.resolvedPath ?? '');
        for (const [k, v] of Object.entries((r.resultParams ?? {}) as Record<string, string>)) {
          result[`${base}${k}`] = v;
        }
      }
    }
  } catch { /* best effort */ }
  return result;
}

// Parses USP GET_SUPPORTED_DM_RESP → flat array of objects with their params
export function parseSupportedDmResp(body: unknown): SupportedObj[] {
  const result: SupportedObj[] = [];
  try {
    const resp = ((body as Record<string, unknown>)?.response as Record<string, unknown>)
      ?.getSupportedDmResp as Record<string, unknown>;
    for (const rr of (resp?.reqObjResults as unknown[]) ?? []) {
      for (const obj of ((rr as Record<string, unknown>).supportedObjs as unknown[]) ?? []) {
        const o = obj as Record<string, unknown>;
        result.push({
          supportedObjPath: String(o.supportedObjPath ?? ''),
          access:           String(o.access ?? 'readOnly'),
          isMultiInstance:  Boolean(o.isMultiInstance),
          supportedParams:  ((o.supportedParams as unknown[]) ?? []).map((p: unknown) => {
            const param = p as Record<string, unknown>;
            return {
              paramName: String(param.paramName ?? ''),
              access:    String(param.access ?? 'readOnly') as 'readOnly' | 'readWrite',
              valueType: String(param.valueType ?? ''),
            };
          }),
        });
      }
    }
  } catch { /* best effort */ }
  return result;
}
