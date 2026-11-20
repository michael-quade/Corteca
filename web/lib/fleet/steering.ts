/**
 * Band / AP steering from `/ouife/steering/details/ouifeapi?type=raw` (cluster CSV, at most one
 * day per call — longer → 400; ~8 MB, 10 s on demo2). One row per client steered in the window:
 * HnName "Topology_80:ab:4d:fe:eb:d0_EasyMesh_TRI" (network + mesh kind), Mac, Model (its AP),
 * Success Rate (0–100) and Cs History — weeks of attempts, "Oct 31 01:00 AM - Oct 31 01:00 AM
 * <from> <to> SUCCESS 4 0.000 0.000" joined by ";" with outcome SUCCESS / NOT-MOVED / MOVED to 2G.
 */
import { parseCsv } from "./csv";
import { normaliseMac } from "./links";

export type Outcome = "success" | "notMoved" | "moved2g" | "other";

export interface SteeredClient {
  mac: string;
  name: string;
  networkId: string;
  mesh: string;
  apModel: string;
  success: number;
  /** [epoch ms, outcome] per attempt in Cs History. */
  attempts: [number, Outcome][];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEGMENT = /^\s*(\w{3}) (\d{1,2}) (\d{2}):(\d{2}) ([AP]M) - .*?\b(SUCCESS|NOT-MOVED|MOVED to \w+)\b/;

/** Cs History times have no year: this year, or last year if that would be in the future. */
function attemptTime(mon: string, day: string, hh: string, mm: string, ap: string, now: number): number | null {
  const m = MONTHS.indexOf(mon);
  if (m < 0) return null;
  const h = (Number(hh) % 12) + (ap === "PM" ? 12 : 0);
  const year = new Date(now).getUTCFullYear();
  let t = Date.UTC(year, m, Number(day), h, Number(mm));
  if (t > now + 2 * 86_400_000) t = Date.UTC(year - 1, m, Number(day), h, Number(mm));
  return t;
}

function outcomeOf(s: string): Outcome {
  if (s === "SUCCESS") return "success";
  if (s === "NOT-MOVED") return "notMoved";
  if (s.startsWith("MOVED to")) return "moved2g";
  return "other";
}

export function parseSteering(csv: string, now = Date.now()): SteeredClient[] {
  const out: SteeredClient[] = [];
  for (const r of parseCsv(csv).rows) {
    const success = Number(r["Success Rate"]);
    const topo = /^Topology_([0-9a-f:]{17})_?(.*)$/i.exec(r.HnName ?? "");
    if (!Number.isFinite(success) || !topo || !/^[0-9a-f:]{17}$/i.test(r.Mac ?? "")) continue;
    const attempts: [number, Outcome][] = [];
    for (const seg of (r["Cs History"] ?? "").split(";")) {
      const m = SEGMENT.exec(seg);
      if (!m) continue;
      const t = attemptTime(m[1], m[2], m[3], m[4], m[5], now);
      if (t != null) attempts.push([t, outcomeOf(m[6])]);
    }
    out.push({
      mac: normaliseMac(r.Mac),
      name: r.Alias || r.Hostname || r["Client Name"] || "",
      networkId: normaliseMac(topo[1]),
      mesh: (topo[2] || "").replace(/_/g, " ") || "Unknown",
      apModel: r.Model ?? "",
      success,
      attempts,
    });
  }
  return out;
}

type Counts = Record<Outcome, number>;
const zero = (): Counts => ({ success: 0, notMoved: 0, moved2g: 0, other: 0 });

export interface SteeringResponse {
  readAt: string;
  clients: number;
  networks: number;
  avgSuccess: number;
  buckets: { label: string; count: number }[];
  attempts: Counts & { total: number };
  attemptsByDay: ({ day: string } & Counts)[];
  byModel: { model: string; clients: number; avg: number }[];
  byMesh: { mesh: string; clients: number; avg: number }[];
  networkRows: { networkId: string; mesh: string; clients: number; avg: number; never: number; attempts: number }[];
  clientRows: { mac: string; name: string; networkId: string; apModel: string; success: number; attempts: number; notMoved: number; moved2g: number }[];
}

const BUCKETS = [
  { label: "0%", test: (s: number) => s === 0 }, { label: "1–24%", test: (s: number) => s > 0 && s < 25 },
  { label: "25–49%", test: (s: number) => s >= 25 && s < 50 }, { label: "50–74%", test: (s: number) => s >= 50 && s < 75 },
  { label: "75–99%", test: (s: number) => s >= 75 && s < 100 }, { label: "100%", test: (s: number) => s >= 100 },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function groupAvg<K extends string>(clients: SteeredClient[], key: (c: SteeredClient) => string, name: K) {
  const g = new Map<string, number[]>();
  for (const c of clients) g.set(key(c), [...(g.get(key(c)) ?? []), c.success]);
  return [...g].map(([k, xs]) => ({ [name]: k, clients: xs.length, avg: avg(xs) }) as Record<K, string> & { clients: number; avg: number })
    .sort((a, b) => b.clients - a.clients);
}

/** Summary over attempts in the last `days` (client figures are for clients steered in the CSV's day). */
export function summariseSteering(clients: SteeredClient[], days: number, readAt: string, now = Date.now()): SteeringResponse {
  const since = Math.floor(now / 86_400_000) * 86_400_000 - (days - 1) * 86_400_000;
  const totals = { ...zero(), total: 0 };
  const byDay = new Map<string, Counts>();
  const clientRows: SteeringResponse["clientRows"] = [];
  const nets = new Map<string, { mesh: string; xs: number[]; attempts: number }>();
  for (const c of clients) {
    const own = zero();
    for (const [t, o] of c.attempts) {
      if (t < since || t > now + 86_400_000) continue;
      own[o]++; totals[o]++; totals.total++;
      const day = new Date(t).toISOString().slice(0, 10);
      const d = byDay.get(day) ?? zero();
      d[o]++;
      byDay.set(day, d);
    }
    const inRange = own.success + own.notMoved + own.moved2g + own.other;
    clientRows.push({ mac: c.mac, name: c.name, networkId: c.networkId, apModel: c.apModel, success: c.success, attempts: inRange, notMoved: own.notMoved, moved2g: own.moved2g });
    const n = nets.get(c.networkId) ?? { mesh: c.mesh, xs: [], attempts: 0 };
    n.xs.push(c.success); n.attempts += inRange;
    nets.set(c.networkId, n);
  }
  return {
    readAt,
    clients: clients.length,
    networks: nets.size,
    avgSuccess: avg(clients.map((c) => c.success)),
    buckets: BUCKETS.map((b) => ({ label: b.label, count: clients.filter((c) => b.test(c.success)).length })),
    attempts: totals,
    attemptsByDay: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, c]) => ({ day, ...c })),
    byModel: groupAvg(clients, (c) => c.apModel || "Unknown model", "model"),
    byMesh: groupAvg(clients, (c) => c.mesh, "mesh"),
    networkRows: [...nets].map(([networkId, n]) => ({ networkId, mesh: n.mesh, clients: n.xs.length, avg: avg(n.xs), never: n.xs.filter((x) => x === 0).length, attempts: n.attempts }))
      .sort((a, b) => a.avg - b.avg || b.clients - a.clients),
    clientRows: clientRows.sort((a, b) => a.success - b.success || b.notMoved - a.notMoved).slice(0, 300),
  };
}
