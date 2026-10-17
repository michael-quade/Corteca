"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { Notice } from "@/web/components/corteca/Notice";

interface Stats { total: number; online: number; offline: number }

export type MapPhase = "idle" | "report" | "locating" | "done" | "error";

interface Props {
  phase: MapPhase;
  stats: Stats | null;
  located: number;
  progress: number;
  geoCount: number | null;
  rateLimited: boolean;
  error: string | null;
  onRetry: () => void;
}

export const isMapBusy = (p: MapPhase) => p === "report" || p === "locating";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const NETWORKS = icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18");
const ONLINE = icon("M5 12.5a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M2 9a15 15 0 0 1 20 0");
const OFFLINE = icon("M2 2l20 20M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M5 12.5a10 10 0 0 1 5.2-2.8M16.5 10.3a10 10 0 0 1 2.5 2.2");
const PIN = icon("M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z");

/** Hover text for "of N eligible": what eligible means and why some aren't on the map. */
function eligibleHint(phase: MapPhase, eligible: number, online: number, located: number): string {
  const what = `Eligible = online networks with a Customer ID (${eligible.toLocaleString()} of ${online.toLocaleString()} online).`;
  const how = "Each is placed using the location stored for it in Corteca.";
  if (phase !== "done") return `${what} ${how} Still resolving locations…`;
  const missing = Math.max(0, eligible - located);
  return `${what} ${how} ${missing ? `${missing.toLocaleString()} have no location in Corteca.` : "All eligible networks were located."}`;
}

const share = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}% of networks` : "");

/** Fleet counts and progress / error notices for the Network Map page. */
export function NetworkMapControls({ phase, stats, located, progress, geoCount, rateLimited, error, onRetry }: Props) {
  return (
    <>
      {stats && (
        <CortecaCard title="Network status">
          <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
            <HealthTile icon={NETWORKS} label="Total networks" value={stats.total.toLocaleString()} sub="in the deployment report" />
            <HealthTile icon={ONLINE} label="Online" value={stats.online.toLocaleString()} sub={share(stats.online, stats.total)} />
            <HealthTile icon={OFFLINE} label="Offline" value={stats.offline.toLocaleString()} sub={share(stats.offline, stats.total)} />
            <HealthTile
              icon={PIN}
              label="Located on map"
              value={located.toLocaleString()}
              sub={geoCount !== null && (
                <span title={eligibleHint(phase, geoCount, stats.online, located)} className="cursor-help underline decoration-neutral-300 decoration-dotted underline-offset-2">
                  of {geoCount.toLocaleString()} eligible
                </span>
              )}
            />
          </div>
        </CortecaCard>
      )}

      {phase === "report" && <Notice title="Generating deployment report…">This can take a minute for a large fleet.</Notice>}
      {phase === "locating" && <Notice title={`Resolving locations… ${progress}%`}>{located} devices placed so far.</Notice>}
      {error && <Notice tone="error" title="Network map error">{error}</Notice>}
      {rateLimited && (
        <Notice tone="error" title="API rate limit reached">
          Some devices could not be located.{" "}
          <button type="button" onClick={onRetry} className="font-medium underline">Retry in 5 minutes.</button>
        </Notice>
      )}
    </>
  );
}
