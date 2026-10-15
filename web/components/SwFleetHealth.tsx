"use client";

import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { toneForPercent, type PillTone } from "@/web/components/corteca/StatusPill";
import type { NetworkSwEntry } from "@/web/components/SwOverview.types";

// Thresholds (percent of the fleet). Online / known releases: ≥95 Good, ≥80 Fair.
const ONLINE_GOOD = 95, ONLINE_FAIR = 80;
const KNOWN_GOOD = 95, KNOWN_FAIR = 80;

function unknownTone(pct: number): { tone: PillTone; label: string } {
  if (pct === 0) return { tone: "good", label: "Good" };
  return pct < 10 ? { tone: "fair", label: "Fair" } : { tone: "poor", label: "Poor" };
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const BEACON = icon("M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 7h4M12 17h.01");
const ONLINE = icon("M5 12.5a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M2 9a15 15 0 0 1 20 0");
const KNOWN = icon("M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4");
const UNKNOWN = icon("M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM10 9.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M12 16h.01");

const fmt = (n: number) => n.toLocaleString();
const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

/** Fleet summary tiles above the release matrix. */
export function SwFleetHealth({ networks, onShowOnline, onShowUnknown }: {
  networks: NetworkSwEntry[];
  onShowOnline: () => void;
  onShowUnknown: () => void;
}) {
  const total = networks.length;
  const online = networks.filter((n) => n.online).length;
  const known = networks.filter((n) => n.releaseName).length;
  const unknown = total - known;
  const onlinePct = pct(online, total), knownPct = pct(known, total), unknownPct = pct(unknown, total);

  return (
    <CortecaCard title="Fleet health" info={`Online and Known releases: Good at ${ONLINE_GOOD}% or more, Fair from ${ONLINE_FAIR}%. Unknown firmware: Good at 0, Fair below 10%.`}>
      <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
        <HealthTile icon={BEACON} label="Beacons" value={fmt(total)} />
        <HealthTile
          icon={ONLINE}
          label="Online"
          value={fmt(online)}
          pill={total ? toneForPercent(onlinePct, ONLINE_GOOD, ONLINE_FAIR) : undefined}
          onClick={onShowOnline}
          hint={`${onlinePct.toFixed(1)}% online — show online only`}
        />
        <HealthTile
          icon={KNOWN}
          label="Known releases"
          value={fmt(known)}
          pill={total ? toneForPercent(knownPct, KNOWN_GOOD, KNOWN_FAIR) : undefined}
          hint={`${knownPct.toFixed(1)}% on a release in the SW Matrix`}
        />
        <HealthTile
          icon={UNKNOWN}
          label="Unknown firmware"
          value={fmt(unknown)}
          pill={total ? unknownTone(unknownPct) : undefined}
          onClick={unknown ? onShowUnknown : undefined}
          hint={`${unknownPct.toFixed(1)}% not matched to a release — show the list`}
        />
      </div>
    </CortecaCard>
  );
}
