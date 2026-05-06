export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  if (typeof window === "undefined") return res;

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("corteca:session-expired"));
  }

  // Bytes sent = URL (the request payload for GETs) + body for POSTs/PUTs
  const url  = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const sent = url.length + (init?.body ? String(init.body).length : 0);

  const cl       = res.headers.get("content-length");
  const received = cl ? (parseInt(cl, 10) || 0) : 0;
  const isRl     = res.status === 429 || res.headers.get("x-rate-limited") === "true";

  window.dispatchEvent(new CustomEvent("corteca:api-call", { detail: { sent, received, isRl } }));

  // When Content-Length is absent (chunked/dev), read the clone to get actual byte count.
  // The corteca:api-bytes handler adds to bytesReceived, so only fire this when received=0.
  if (!cl) {
    res.clone().text().then((t) =>
      window.dispatchEvent(new CustomEvent("corteca:api-bytes", { detail: t.length }))
    ).catch(() => {});
  }

  return res;
}
