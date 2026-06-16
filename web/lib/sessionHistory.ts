const LS_KEY = 'corteca:sessions';

export interface SessionRecord {
  id: string;
  startTime: number;
  endTime: number | null;
  calls: number;
  bytesSent: number;
  bytesReceived: number;
  rateLimitHits: number;
}

export type Period = 'day' | 'week' | 'month' | 'year';

export interface PeriodBucket {
  key: string;
  label: string;
  authEvents: number;
  calls: number;
  bytesSent: number;
  bytesReceived: number;
  rateLimitHits: number;
}

export function loadSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}

export function saveSessions(sessions: SessionRecord[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(sessions.slice(-500))); } catch { /* quota */ }
}

export function createSession(): SessionRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    startTime: Date.now(), endTime: null,
    calls: 0, bytesSent: 0, bytesReceived: 0, rateLimitHits: 0,
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function bucketKey(ts: number, p: Period): string {
  const d = new Date(ts);
  if (p === 'day')   return localDateStr(d);
  if (p === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (p === 'year')  return String(d.getFullYear());
  // week: Monday-based, local dates throughout
  const dow = d.getDay() || 7;
  const mon = new Date(d); mon.setDate(d.getDate() - dow + 1);
  return localDateStr(mon);
}

function bucketLabel(ts: number, p: Period): string {
  const d = new Date(ts);
  if (p === 'month') return d.toLocaleDateString('en', { month: 'short', year: 'numeric' });
  if (p === 'year')  return String(d.getFullYear());
  if (p === 'day')   return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const dow = d.getDay() || 7;
  const mon = new Date(d); mon.setDate(d.getDate() - dow + 1);
  return `${mon.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
}

const emptyBucket = (key: string, label: string): PeriodBucket =>
  ({ key, label, authEvents: 0, calls: 0, bytesSent: 0, bytesReceived: 0, rateLimitHits: 0 });

// Build a pre-filled scaffold of empty buckets covering a fixed window per period
// so each tab always shows a meaningful time range even with sparse data.
function scaffoldBuckets(period: Period): Map<string, PeriodBucket> {
  const map = new Map<string, PeriodBucket>();
  const now = Date.now();

  if (period === 'day') {
    // Last 7 days (today + 6 previous)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      map.set(key, emptyBucket(key, bucketLabel(d.getTime(), 'day')));
    }
  } else if (period === 'week') {
    // Last 8 weeks
    const seen = new Set<string>();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = bucketKey(d.getTime(), 'week');
      if (!seen.has(key)) {
        seen.add(key);
        map.set(key, emptyBucket(key, bucketLabel(d.getTime(), 'week')));
      }
    }
  } else if (period === 'month') {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = bucketKey(d.getTime(), 'month');
      map.set(key, emptyBucket(key, bucketLabel(d.getTime(), 'month')));
    }
  }
  // 'year': no scaffold — show all actual years found in data

  return map;
}

export function aggregateSessions(sessions: SessionRecord[], period: Period): PeriodBucket[] {
  // Scaffold fills in empty buckets for the recent window so each period tab
  // looks visually distinct. Sessions older than the window still get their
  // own bucket added below — no history is discarded.
  const map = scaffoldBuckets(period);

  for (const s of sessions) {
    const key = bucketKey(s.startTime, period);
    const ex  = map.get(key);
    if (ex) {
      ex.authEvents++;
      ex.calls         += s.calls;
      ex.bytesSent     += s.bytesSent;
      ex.bytesReceived += s.bytesReceived;
      ex.rateLimitHits += s.rateLimitHits;
    } else {
      map.set(key, { key, label: bucketLabel(s.startTime, period), authEvents: 1, calls: s.calls, bytesSent: s.bytesSent, bytesReceived: s.bytesReceived, rateLimitHits: s.rateLimitHits });
    }
  }

  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}
