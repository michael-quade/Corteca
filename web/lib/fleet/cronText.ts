/**
 * Corteca schedules use Quartz cron (sec min hour day month weekday). Plain daily times read as
 * "Daily at 03:00"; anything else is shown as written.
 */
export function cronText(cron: string): string {
  const f = cron.trim().split(/\s+/);
  if (f.length < 6) return cron || "—";
  const [sec, min, hour, dom, mon, dow] = f;
  const wild = (v: string) => v === "*" || v === "?";
  if (sec === "0" && /^\d+$/.test(min) && wild(dom) && wild(mon) && wild(dow)) {
    const hours = hour.split(",");
    if (hours.every((h) => /^\d+$/.test(h))) {
      return `Daily at ${hours.map((h) => `${h.padStart(2, "0")}:${min.padStart(2, "0")}`).join(", ")}`;
    }
  }
  return cron;
}
