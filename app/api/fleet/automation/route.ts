import { NextRequest, NextResponse } from "next/server";
import { cortecaGet, cortecaJson } from "@/web/lib/fleet/cortecaRead";
import {
  parseCompliance, parseRule, parseRuleTrend, parseSchedule, parseScheduleReport,
  type AutomationResponse, type RuleRow, type ScheduleRow,
} from "@/web/lib/fleet/automation";

/**
 * Fleet Metrics → Automation (read-only): proactive reboot rules with their daily outcome
 * trend over the last `days`, and scheduled speed / latency tests — compliance, devices and
 * results for enabled schedules only (disabled ones aren't read further).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 7)));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const range = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  const errors: string[] = [];
  const soft = async <T,>(what: string, p: Promise<T>): Promise<T | null> => {
    try { return await p; } catch (e) { errors.push(`${what}: ${e instanceof Error ? e.message : String(e)}`); return null; }
  };

  const [rulesRaw, schedulesRaw] = await Promise.all([
    soft("Proactive rules", cortecaJson<unknown[]>(base, token, "/proactive-engine/rules")),
    soft("Schedules", cortecaJson<unknown[]>(base, token, "/scheduler/schedules")),
  ]);

  const ruleDaily = new Map<string, { success: number; failure: number; skipped: number }>();
  const rules: RuleRow[] = await Promise.all((Array.isArray(rulesRaw) ? rulesRaw : []).map(parseRule).filter((r) => r != null).map(async (r) => {
    const trend = parseRuleTrend(await soft(`Trend of ${r.name}`, cortecaJson(base, token, `/proactive-engine/rules/${r.id}/trends?${range}`)));
    const totals = { success: 0, failure: 0, skipped: 0 };
    let lastRun: string | null = null;
    for (const d of trend) {
      totals.success += d.success; totals.failure += d.failure; totals.skipped += d.skipped;
      if (d.success + d.failure + d.skipped > 0 && (!lastRun || d.day > lastRun)) lastRun = d.day;
      const cur = ruleDaily.get(d.day) ?? { success: 0, failure: 0, skipped: 0 };
      cur.success += d.success; cur.failure += d.failure; cur.skipped += d.skipped;
      ruleDaily.set(d.day, cur);
    }
    return { ...r, totals, lastRun };
  }));

  const schedules: ScheduleRow[] = await Promise.all((Array.isArray(schedulesRaw) ? schedulesRaw : []).map(parseSchedule).filter((x) => x != null).map(async (sc) => {
    if (!sc.enabled) return { ...sc, devices: null, compliance: null, results: null };
    const [devices, compliance, report] = await Promise.all([
      soft(`Devices of ${sc.name}`, cortecaJson<unknown[]>(base, token, `/scheduler/schedules/${sc.id}/devices`)),
      soft(`Compliance of ${sc.name}`, cortecaJson(base, token, `/scheduler/schedules/${sc.id}/compliance?${range}`)),
      soft(`Results of ${sc.name}`, cortecaGet(base, token, `/scheduler/schedules/${sc.id}/reports?${range}`, { csv: true })),
    ]);
    return {
      ...sc,
      devices: Array.isArray(devices) ? devices.length : null,
      compliance: parseCompliance(compliance),
      results: report ? parseScheduleReport(report) : null,
    };
  }));

  const body: AutomationResponse = {
    rules: rules.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)),
    ruleDaily: [...ruleDaily].filter(([day]) => day >= from.toISOString().slice(0, 10)).sort(([a], [b]) => a.localeCompare(b)).map(([day, t]) => ({ day, ...t })),
    schedules: schedules.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)),
    errors,
  };
  if (rulesRaw == null && schedulesRaw == null) return NextResponse.json({ error: errors.join(" · ") }, { status: 502 });
  return NextResponse.json(body);
}
