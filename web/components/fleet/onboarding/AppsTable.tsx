"use client";

import { StatusPill } from "@/web/components/corteca/StatusPill";
import { FleetTable } from "@/web/components/tables/FleetTable";
import { fmtInt } from "@/web/lib/fleet/labels";
import type { AppRow } from "@/web/lib/fleet/onboarding";

const n = (v: number | null) => (v == null ? "—" : fmtInt(v));

/** Container apps: version, status, all-time installs and activity in the range. */
export function AppsTable({ apps }: { apps: AppRow[] }) {
  return (
    <FleetTable<AppRow>
      rows={apps}
      rowKey={(a) => a.uuid}
      maxHeight="max-h-[420px]"
      empty="No container apps."
      columns={[
        { key: "name", label: "App", render: (a) => <span className="font-medium">{a.name}</span>, sort: (a) => a.name },
        { key: "cat", label: "Category", render: (a) => a.categories || "—", sort: (a) => a.categories },
        { key: "status", label: "Status", render: (a) => <StatusPill tone={a.status === "Production" ? "info" : "neutral"}>{a.status || "—"}</StatusPill>, sort: (a) => a.status },
        { key: "ver", label: "Latest", render: (a) => <span title={a.versions.join(", ")}>{a.latest || "—"}{a.versions.length > 1 ? <span className="text-xs text-neutral-500"> · {a.versions.length} versions</span> : null}</span> },
        { key: "inst", label: "Installed", numeric: true, render: (a) => n(a.installed), sort: (a) => a.installed ?? -1 },
        { key: "uninst", label: "Uninstalled", numeric: true, render: (a) => n(a.uninstalled), sort: (a) => a.uninstalled ?? -1 },
        { key: "new", label: "Installs", numeric: true, render: (a) => fmtInt(a.installs), sort: (a) => a.installs },
        { key: "fail", label: "Failures", numeric: true, render: (a) => fmtInt(a.failures), sort: (a) => a.failures },
        { key: "rm", label: "Removals", numeric: true, render: (a) => fmtInt(a.removals), sort: (a) => a.removals },
      ]}
    />
  );
}
