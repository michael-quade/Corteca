"use client";

import { FleetTable, type FleetColumn } from "./FleetTable";
import { rankingKey, type RankingRow } from "@/web/lib/fleet/rankings";

export type RankingColumn = FleetColumn<RankingRow>;

/**
 * A Corteca report ranking as a sortable table (Fleet Metrics). Rows set aside by the
 * noisy-device rule stay listed, tinted, so nothing disappears silently.
 */
export function FleetRankingTable({ rows, columns, setAside, maxHeight = "max-h-[60vh]" }: {
  rows: RankingRow[];
  columns: RankingColumn[];
  setAside?: Set<RankingRow>;
  maxHeight?: string;
}) {
  return (
    <FleetTable
      rows={rows} columns={columns} rowKey={rankingKey} maxHeight={maxHeight}
      tinted={setAside ? (r) => setAside.has(r) : undefined}
      empty="Corteca returned no rows for this range."
    />
  );
}
