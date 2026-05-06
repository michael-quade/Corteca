export interface ApiStats {
  calls: number;
  bytesSent: number;
  bytesReceived: number;
  rateLimitHits: number;
  sessionStart: number;
}

let s: ApiStats = { calls: 0, bytesSent: 0, bytesReceived: 0, rateLimitHits: 0, sessionStart: Date.now() };

export function getApiStats(): ApiStats { return { ...s }; }
export function resetApiStats(): void { s = { calls: 0, bytesSent: 0, bytesReceived: 0, rateLimitHits: 0, sessionStart: Date.now() }; }
export function recordCall(bytesSent: number, bytesReceived: number, isRateLimit: boolean): void {
  s.calls++;
  s.bytesSent += bytesSent;
  s.bytesReceived += bytesReceived;
  if (isRateLimit) s.rateLimitHits++;
}
export function addReceivedBytes(n: number): void { s.bytesReceived += n; }
