"use client";

import type { MeshCountsState } from "@/web/lib/useMeshCounts";

function ago(at: number): string {
  const min = Math.round((Date.now() - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return `${h} h ago`;
}

/** Where the card's numbers come from: the report (All homes) or the live mesh (Gateway online). */
export function MeshCountStatus({ scope, mesh, wentOffline, reportOnly }: {
  scope: "all" | "online";
  mesh: MeshCountsState;
  /** Homes the report lists online whose gateway the mesh shows offline (left out of the view). */
  wentOffline: number;
  /** Homes still on report numbers (no mesh, or the read failed). */
  reportOnly: number;
}) {
  if (scope === "all") {
    return (
      <p className="text-xs text-neutral-500">
        Devices registered to each home in the deployment report — it keeps devices that have left the mesh,
        and its online status can lag. <span className="text-neutral-700">Gateway online</span> counts from the live mesh, as the console does.
      </p>
    );
  }
  if (mesh.loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-neutral-600">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
        Reading Corteca&apos;s live mesh… {mesh.done.toLocaleString()} of {mesh.total.toLocaleString()} homes
        <span className="text-neutral-500">(homes not read yet show report numbers)</span>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
      <span>
        WiFi points and online status from Corteca&apos;s live mesh, as in the console
        {mesh.readAt && <> · read {ago(mesh.readAt)}</>}
      </span>
      <button type="button" onClick={mesh.reread} className="font-medium text-blue-600 hover:underline">Re-read</button>
      {wentOffline > 0 && <span>· {wentOffline.toLocaleString()} listed online in the report are offline in the mesh, so left out</span>}
      {reportOnly > 0 && <span>· {reportOnly.toLocaleString()} keep report numbers (no mesh{mesh.failed.size ? " or read failed" : ""})</span>}
    </p>
  );
}
