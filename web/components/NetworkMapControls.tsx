"use client";


interface Stats { total: number; online: number; offline: number }

export type MapPhase = "idle" | "report" | "locating" | "done" | "error";

interface Props {
  phase: MapPhase;
  stats: Stats | null;
  located: number;
  progress: number;
  reportCachedAt: number | null;
  geoCount: number | null;
  rateLimited: boolean;
  error: string | null;
  onNewReport: () => void;
  onRefreshLocations: () => void;
  onRetry: () => void;
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-sm text-neutral-900">{label}</p>
    </div>
  );
}

const isBusy = (p: MapPhase) => p === "report" || p === "locating";

export function NetworkMapControls({
  phase, stats, located, progress, reportCachedAt, geoCount, rateLimited, error,
  onNewReport, onRefreshLocations, onRetry,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Network Map</h1>
          <p className="mt-1 text-sm text-neutral-500">All managed WiFi networks plotted by location.</p>
          {reportCachedAt && (
            <p className="mt-1 text-sm text-neutral-600">
              Report as of: <span className="font-medium">{new Date(reportCachedAt).toLocaleString()}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button" onClick={onNewReport} disabled={isBusy(phase)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40"
            title="Fetch a fresh deployment report from Corteca"
          >
            New Report
          </button>
          <button
            type="button" onClick={onRefreshLocations} disabled={isBusy(phase)}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-400 disabled:opacity-40"
            title="Re-locate all devices (clears location cache)"
          >
            Refresh Locations
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Networks"  value={stats.total}   color="text-neutral-900" />
            <StatCard label="Online"          value={stats.online}  color="text-green-600" />
            <StatCard label="Offline"         value={stats.offline} color="text-red-500" />
            <StatCard label="Located on Map"  value={located}       color="text-blue-600" />
          </div>
          {geoCount !== null && (
            <p className="text-xs text-neutral-400">
              Map shows active networks with a valid Customer ID ({geoCount} of {stats.online} online networks eligible).
            </p>
          )}
        </div>
      )}

      {/* Phase status */}
      {phase === "report" && (
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Generating deployment report…
        </div>
      )}
      {phase === "locating" && (
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
          Resolving locations… {progress}% ({located} devices placed)
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}
      {rateLimited && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <span className="font-semibold">API rate limit reached</span> — some devices could not be located.{" "}
          <button type="button" onClick={onRetry} className="underline hover:text-amber-900">Retry in 5 minutes.</button>
        </div>
      )}

    </div>
  );
}
