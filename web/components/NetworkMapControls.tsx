"use client";

import { cn } from "@/web/lib/utils";

interface Stats { total: number; online: number; offline: number }

export type MapPhase = "idle" | "report" | "locating" | "done" | "error";

interface Props {
  phase: MapPhase;
  stats: Stats | null;
  located: number;
  progress: number;
  reportAge: string | null;
  rateLimited: boolean;
  error: string | null;
  showOnline: boolean;
  showOffline: boolean;
  onNewReport: () => void;
  onRefreshLocations: () => void;
  onToggleOnline: () => void;
  onToggleOffline: () => void;
  onRetry: () => void;
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

const isBusy = (p: MapPhase) => p === "report" || p === "locating";

export function NetworkMapControls({
  phase, stats, located, progress, reportAge, rateLimited, error,
  showOnline, showOffline,
  onNewReport, onRefreshLocations, onToggleOnline, onToggleOffline, onRetry,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Network Map</h1>
          <p className="mt-1 text-sm text-neutral-500">All managed WiFi networks plotted by location.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reportAge && <span className="text-xs text-neutral-400">Report from {reportAge}</span>}
          <button
            type="button" onClick={onNewReport} disabled={isBusy(phase)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            title="Fetch a fresh deployment report from Corteca"
          >
            New Report
          </button>
          <button
            type="button" onClick={onRefreshLocations} disabled={isBusy(phase)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            title="Re-locate all devices (clears location cache)"
          >
            Refresh Locations
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Networks"  value={stats.total}   color="text-neutral-900" />
          <StatCard label="Online"          value={stats.online}  color="text-green-600" />
          <StatCard label="Offline"         value={stats.offline} color="text-red-500" />
          <StatCard label="Located on Map"  value={located}       color="text-blue-600" />
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

      {/* Online / offline toggles */}
      {(phase === "locating" || phase === "done") && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">Show:</span>
          <button
            type="button" onClick={onToggleOnline}
            className={cn("flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
              showOnline ? "border-green-300 bg-green-50 text-green-700" : "border-neutral-200 bg-white text-neutral-400 line-through")}
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", showOnline ? "bg-green-500" : "bg-neutral-300")} />
            Online{stats ? ` (${stats.online})` : ""}
          </button>
          <button
            type="button" onClick={onToggleOffline}
            className={cn("flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
              showOffline ? "border-red-300 bg-red-50 text-red-600" : "border-neutral-200 bg-white text-neutral-400 line-through")}
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", showOffline ? "bg-red-500" : "bg-neutral-300")} />
            Offline{stats ? ` (${stats.offline})` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
