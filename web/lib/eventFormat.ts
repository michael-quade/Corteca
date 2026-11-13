// Time / duration wording for the network events views, and the CSV export.

import type { EventItem } from "./eventItems";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const dayHeading = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
export const shortDay = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
export const dateOnly = (ms: number) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short" });

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "45 s", "9 min", "2 h 21 min", "3 d 4 h" */
export function duration(ms: number): string {
  if (ms < MINUTE) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const mins = Math.round(ms / MINUTE);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

/** "just now", "12 min ago", "2 h ago", "3 d ago" */
export function ago(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  return `${Math.round(diff / DAY)} d ago`;
}

/** Time column: "14:08", or "14:08 → 14:17" for a span (with the end day when it differs). */
export function spanLabel(item: EventItem): string {
  if (item.end == null || item.end - item.start < MINUTE) return clock(item.start);
  const sameDay = startOfDay(item.start) === startOfDay(item.end);
  return `${clock(item.start)} → ${sameDay ? "" : `${dateOnly(item.end)} `}${clock(item.end)}`;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Every Corteca event behind the listed rows, one per line (data already sanitised). */
export function eventsCsv(items: EventItem[], nameOf: (mac: string | null) => string): string {
  const rows = [["Time (UTC)", "Summary", "Corteca operation", "Device", "Device MAC", "Origin", "Details"]];
  for (const item of items) {
    for (const e of item.events) {
      rows.push([
        new Date(e.at).toISOString(), item.title, e.operation, nameOf(e.device), e.device ?? "",
        [e.originType, e.originId].filter(Boolean).join(" "),
        Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join("; "),
      ]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadText(text: string, filename: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
