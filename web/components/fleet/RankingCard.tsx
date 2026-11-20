"use client";

import { useMemo } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { FleetRankingTable } from "@/web/components/tables/FleetRankingTable";
import { HBarChart } from "./HBarChart";
import { NoisyNote } from "./NoisyNote";
import { ViewStatus } from "./ViewStatus";
import { deviceLabel } from "./rankingColumns";
import { splitNoisy } from "@/web/lib/fleet/noisy";
import type { RankingResponse } from "@/web/lib/fleet/rankings";
import type { RankingCardProps } from "./RankingCard.types";

const CHART_ROWS = 10;

/**
 * One Corteca report ranking: the top rows as bars (optionally after the noisy-device rule),
 * then every row in a sortable table. `filter` narrows rows (e.g. by band) before both.
 */
export function RankingCard({ title, info, res, columns, chart, noisyFactor, filter, actions }: RankingCardProps) {
  const rows = useMemo(() => (res.data?.rows ?? []).filter(filter ?? (() => true)), [res.data, filter]);
  const { kept, setAside } = useMemo(
    () => (chart && noisyFactor != null ? splitNoisy(rows, chart.value, noisyFactor) : { kept: chart?.rankOrder ? rows : [...rows].sort((a, b) => (chart ? chart.value(b) - chart.value(a) : 0)), setAside: [] }),
    [rows, chart, noisyFactor],
  );
  const asideSet = useMemo(() => new Set(setAside.map((s) => s.item)), [setAside]);

  return (
    <CortecaCard title={title} info={info} actions={actions}>
      {!res.data ? <ViewStatus loading={res.loading} error={res.error} what={title.toLowerCase()} /> : (
        <div className="space-y-4">
          {chart && (
            <div>
              <HBarChart
                rows={kept.slice(0, CHART_ROWS).map((r) => ({ label: chart.label?.(r) ?? deviceLabel(r), sub: r.subscriberId, value: chart.value(r) }))}
                series={[{ key: "value", label: chart.seriesLabel, color: chart.color ?? "#2563eb" }]}
                unit={chart.unit}
                max={chart.max}
              />
              {noisyFactor != null && <NoisyNote items={setAside} name={deviceLabel} unit={chart.seriesLabel.toLowerCase()} factor={noisyFactor} />}
            </div>
          )}
          <FleetRankingTable rows={rows} columns={columns} setAside={asideSet} maxHeight="max-h-[420px]" />
          <p className="text-xs text-neutral-500">{rangeNote(res.data)} · {rows.length} rows (Corteca returns at most 100)</p>
        </div>
      )}
    </CortecaCard>
  );
}

function rangeNote(d: RankingResponse): string {
  return `Corteca daily reports ${d.from} to ${d.to}`;
}

