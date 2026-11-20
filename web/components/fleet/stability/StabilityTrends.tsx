"use client";

import { useMemo } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { FillProgress } from "@/web/components/fleet/FillProgress";
import { TimeBars, type TimeRow } from "@/web/components/fleet/TimeBars";
import { fmtInt } from "@/web/lib/fleet/labels";
import { splitNoisy } from "@/web/lib/fleet/noisy";
import type { DaySummary, ReportTrendResponse, TrendDay } from "@/web/lib/fleet/reportTrend";
import type { FillState } from "@/web/lib/fleet/useFleetFill";

const CAT = ["#2a78d6", "#eb6834", "#1baf7a"];
const OTHER = "#a3a3a3";

/** Daily series of a report's `parts` (reboot reasons, shaped-event kinds): top 3 + "Other". */
function partSeries(days: TrendDay[], label: (k: string) => string) {
  const totals = new Map<string, number>();
  for (const d of days) for (const [k, v] of Object.entries(d.summary?.parts ?? {})) totals.set(k, (totals.get(k) ?? 0) + v);
  const top = [...totals].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const rows: TimeRow[] = days.map((d) => {
    const row: TimeRow = { t: d.day };
    if (!d.summary) return row;
    let other = 0;
    for (const [k, v] of Object.entries(d.summary.parts ?? {})) if (top.includes(k)) row[k] = v; else other += v;
    if (other) row.other = other;
    return row;
  });
  const series = top.map((k, i) => ({ key: k, label: label(k), color: CAT[i] }));
  if (rows.some((r) => r.other)) series.push({ key: "other", label: "Other", color: OTHER });
  return { rows, series };
}

/** Per-day events with noisy devices (judged on their totals over the range) taken out. */
function withoutNoisy(days: TrendDay[], factor: number) {
  const perDevice = new Map<string, number>();
  for (const d of days) for (const [dev, n] of Object.entries(d.summary?.top ?? {})) perDevice.set(dev, (perDevice.get(dev) ?? 0) + n);
  const { setAside } = splitNoisy([...perDevice], ([, n]) => n, factor);
  const aside = new Set(setAside.map((s) => s.item[0]));
  const rows: TimeRow[] = days.map((d) => {
    if (!d.summary) return { t: d.day };
    const out = Object.entries(d.summary.top ?? {}).filter(([dev]) => aside.has(dev)).reduce((a, [, n]) => a + n, 0);
    return { t: d.day, kept: d.summary.events - out, aside: out };
  });
  return { rows, aside: [...aside], asideTotal: setAside.reduce((a, s) => a + s.value, 0) };
}

const reason = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Stability trends: reboots per day by reason, cloud disconnections per day, shaped events per day. */
export function StabilityTrends({ state, noisy }: { state: FillState<ReportTrendResponse>; noisy: number }) {
  const t = state.data;
  const reboot = useMemo(() => partSeries(t?.types.reboot ?? [], reason), [t]);
  const cloud = useMemo(() => withoutNoisy(t?.types.cloud_disconnection ?? [], noisy), [t, noisy]);
  const shaped = useMemo(() => partSeries(t?.types.shaped_event ?? [], (k) => reason(k.toLowerCase().replace(/-/g, " "))), [t]);
  const devices = (d: DaySummary | null | undefined) => d?.devices ?? 0;

  return (
    <div className="space-y-6">
      <FillProgress state={state} unit="report days" what="the daily reports" />
      {t && (
        <div className="grid gap-6 xl:grid-cols-2">
          <CortecaCard title="Reboots per day" info={`By reason, from Corteca's daily reboot reports. Devices rebooting: ${(t.types.reboot ?? []).map((d) => devices(d.summary)).join(" / ")}. Corteca keeps 7 days; older days appear once the daily update has stored them.`}>
            <TimeBars rows={reboot.rows} series={reboot.series} height={220} />
          </CortecaCard>
          <CortecaCard title="Cloud disconnections per day" info="From the daily cloud-disconnection reports. Set-aside devices are judged on their total over the range.">
            <TimeBars rows={cloud.rows} series={[{ key: "kept", label: "Disconnections", color: "#2563eb" }]} height={220} />
            {cloud.aside.length > 0 && (
              <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs text-yellow-900 ring-1 ring-yellow-200">
                Not charted: {cloud.aside.join(", ")} — {fmtInt(cloud.asideTotal)} disconnections (noisy-device limit).
              </p>
            )}
          </CortecaCard>
          <CortecaCard title="Shaped events per day" info="Corteca's shaped-event report: client and mesh event bursts per device and hour (associations, mesh, DHCP, RSSI threshold…).">
            <TimeBars rows={shaped.rows} series={shaped.series} height={200} />
          </CortecaCard>
        </div>
      )}
    </div>
  );
}
