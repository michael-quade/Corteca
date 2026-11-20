"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { FillProgress } from "@/web/components/fleet/FillProgress";
import { HBarChart } from "@/web/components/fleet/HBarChart";
import { NoisyNote } from "@/web/components/fleet/NoisyNote";
import { TimeBars } from "@/web/components/fleet/TimeBars";
import { AlarmApTable } from "./AlarmApTable";
import { categoryLabel, raised, type AlarmsResponse } from "@/web/lib/fleet/alarms";
import { fmtInt, pctOf, prettyModel } from "@/web/lib/fleet/labels";
import { normaliseMac } from "@/web/lib/fleet/links";
import { splitNoisy } from "@/web/lib/fleet/noisy";
import { rangeLabel, type FleetRange } from "@/web/lib/fleet/fleetTabs";
import type { FillState } from "@/web/lib/fleet/useFleetFill";

export const SEVERITY_SERIES = [
  { key: "CRITICAL", label: "Critical", color: "#dc2626" },
  { key: "MAJOR", label: "Major", color: "#f97316" },
  { key: "MINOR", label: "Minor", color: "#facc15" },
];

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ICONS = {
  bell: icon("M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"),
  crit: icon("M12 8v5M12 16h.01M4 20h16L12 4z"),
  ap: icon("M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M12 18h.01"),
  tag: icon("M4 4h7l9 9-7 7-9-9zM8 8h.01"),
};

/** Alarms: alarm changes per hour / day by severity, by category and model, and the APs that raise the most. */
export function AlarmsView({ state, range, noisy }: { state: FillState<AlarmsResponse>; range: FleetRange; noisy: number }) {
  const d = state.data;
  const split = useMemo(() => splitNoisy(d?.aps ?? [], (a) => a.raised, noisy), [d, noisy]);
  const aside = useMemo(() => new Set(split.setAside.map((s) => s.item.mac)), [split]);
  const models = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of split.kept) m.set(prettyModel(a.model), (m.get(prettyModel(a.model)) ?? 0) + a.raised);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [split]);

  if (!d) return <FillProgress state={state} unit="hours" what="the alarm history" />;
  const total = raised(d.totals);
  const asideRaised = split.setAside.reduce((a, s) => a + s.value, 0);
  const topCat = d.categories[0];

  return (
    <div className="space-y-6">
      <FillProgress state={state} unit="hours" what="the alarm history" />
      <CortecaCard
        title="Alarms"
        info={`Alarm changes Corteca logged across the cluster in the last ${rangeLabel(range)} (UTC hours). Raised = critical + major + minor; clears are counted apart.`}
        actions={<Link href="/alarms" className="text-sm font-medium text-blue-600 hover:text-blue-700">Open Network Alarms →</Link>}
      >
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
          <HealthTile icon={ICONS.bell} label="Raised" value={fmtInt(total)} sub={asideRaised ? `${pctOf(asideRaised, total, 0)} from set-aside devices` : `${fmtInt(d.totals.CLEAR ?? 0)} cleared`} />
          <HealthTile icon={ICONS.crit} label="Critical" value={fmtInt(d.totals.CRITICAL ?? 0)} sub={`${pctOf(d.totals.CRITICAL ?? 0, total)} of raised`} />
          <HealthTile icon={ICONS.ap} label="APs raising alarms" value={fmtInt(d.aps.length)} sub={split.setAside.length ? `${split.setAside.length} set aside` : undefined} />
          <HealthTile icon={ICONS.tag} label="Top category" value={topCat ? fmtInt(raised(topCat)) : "—"} sub={topCat ? categoryLabel(topCat.category) : undefined} />
        </div>
        {d.truncatedHours > 0 && <p className="mt-3 text-xs text-yellow-800">{d.truncatedHours} hour(s) hit Corteca&apos;s 10,000-row limit, so their counts are a floor.</p>}
      </CortecaCard>

      <CortecaCard title={`Alarms raised per ${d.bucket}`} info="Stacked by severity. Includes set-aside devices (the history has no per-device time split).">
        <TimeBars rows={d.series} series={SEVERITY_SERIES} hourly={d.bucket === "hour"} />
      </CortecaCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <CortecaCard title="By category">
          <HBarChart
            rows={d.categories.filter((c) => raised(c) > 0).slice(0, 10).map((c) => ({ label: categoryLabel(c.category), CRITICAL: c.CRITICAL ?? 0, MAJOR: c.MAJOR ?? 0, MINOR: c.MINOR ?? 0 }))}
            series={SEVERITY_SERIES} labelWidth={190}
          />
        </CortecaCard>
        <CortecaCard title="By model" info="Raised alarms per AP model, without set-aside devices.">
          <HBarChart rows={models.map(([label, value]) => ({ label, value }))} series={[{ key: "value", label: "Raised alarms", color: "#2563eb" }]} labelWidth={190} />
        </CortecaCard>
      </div>

      <CortecaCard title="APs raising the most alarms">
        <NoisyNote items={split.setAside} name={(a) => `${prettyModel(a.model)} ${normaliseMac(a.mac)}`} unit="alarms" factor={noisy} />
        <div className="mt-3"><AlarmApTable aps={d.aps} aside={aside} /></div>
      </CortecaCard>
    </div>
  );
}
