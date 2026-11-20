import type { ReactNode } from "react";
import type { RankingColumn } from "@/web/components/tables/FleetRankingTable";
import type { RankingResponse, RankingRow } from "@/web/lib/fleet/rankings";
import type { FleetResource } from "@/web/lib/fleet/useFleetData";

export interface RankingChart {
  /** The value each bar shows. */
  value: (r: RankingRow) => number;
  seriesLabel: string;
  unit?: string;
  max?: number;
  color?: string;
  /** Keep Corteca's rank order instead of sorting by `value` (coverage ranks by its affected metric). */
  rankOrder?: boolean;
  /** Bar label; defaults to "model · MAC end". */
  label?: (r: RankingRow) => string;
}

export interface RankingCardProps {
  title: string;
  info?: string;
  res: FleetResource<RankingResponse>;
  columns: RankingColumn[];
  chart?: RankingChart;
  /** Apply the noisy-device rule to the chart with this factor (counts only, not averages). */
  noisyFactor?: number;
  filter?: (r: RankingRow) => boolean;
  actions?: ReactNode;
}
