"use client";

import { useMemo } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { DeploymentTable } from "@/web/components/tables/DeploymentTable";

const homeOf = (r: Record<string, string>) => (r["Home WiFi ID"] || r["MAC"] || "").trim();

/** Network Map's deployment report: follows the map — region filter, then a pinned network. */
export function DeploymentReportCard({ rawRows, headers, macFilter, regionMacs, regionSummary, shownCount }: {
  rawRows: Record<string, string>[];
  headers: string[];
  macFilter: string | null;
  regionMacs: Set<string> | null;
  regionSummary: string;
  shownCount: number;
}) {
  const rows = useMemo(() => {
    if (!macFilter && !regionMacs) return rawRows;
    return rawRows.filter((r) => {
      const mac = homeOf(r);
      return (!regionMacs || regionMacs.has(mac)) && (!macFilter || mac === macFilter);
    });
  }, [rawRows, macFilter, regionMacs]);

  if (!rawRows.length) return null;

  return (
    <CortecaCard
      title="Deployment report"
      info={regionMacs ? "With a location filter set, only networks placed on the map are listed (the map locates online networks with a Customer ID)." : undefined}
      actions={(macFilter || regionMacs) && (
        <span className="text-sm text-blue-600">
          Filtered to {macFilter
            ? rawRows.find((r) => homeOf(r) === macFilter)?.["Account Name"] || macFilter
            : `${regionSummary} · ${shownCount.toLocaleString()} network${shownCount === 1 ? "" : "s"}`}
        </span>
      )}
    >
      <DeploymentTable rows={rows} headers={headers} />
    </CortecaCard>
  );
}
