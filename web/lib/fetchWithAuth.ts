export interface ApiCallLogEntry {
  timestamp: Date;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  bodyPromise: Promise<string>;
}

type ApiLogInterceptor = (entry: ApiCallLogEntry) => void;
let _logInterceptor: ApiLogInterceptor | null = null;

export function setApiLogInterceptor(fn: ApiLogInterceptor | null): void {
  _logInterceptor = fn;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const start = Date.now();
  const method = ((init?.method) ?? "GET").toUpperCase();
  const rawUrl = typeof input === "string" ? input
    : input instanceof URL ? input.toString()
    : (input as Request).url;

  const res = await fetch(input, init);

  if (typeof window === "undefined") return res;

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("corteca:session-expired"));
  }

  const sent = rawUrl.length + (init?.body ? String(init.body).length : 0);
  const cl       = res.headers.get("content-length");
  const received = cl ? (parseInt(cl, 10) || 0) : 0;
  const isRl     = res.status === 429 || res.headers.get("x-rate-limited") === "true";

  window.dispatchEvent(new CustomEvent("corteca:api-call", { detail: { sent, received, isRl } }));

  if (!cl) {
    res.clone().text().then((t) =>
      window.dispatchEvent(new CustomEvent("corteca:api-bytes", { detail: t.length }))
    ).catch(() => {});
  }

  if (_logInterceptor) {
    const durationMs = Date.now() - start;
    const bodyPromise = res.clone().text()
      .then((t) => (t.length > 5000 ? t.slice(0, 5000) + "\n… (truncated)" : t))
      .catch(() => "[unreadable]");
    _logInterceptor({ timestamp: new Date(), method, url: rawUrl, status: res.status, statusText: res.statusText, durationMs, bodyPromise });
  }

  return res;
}
