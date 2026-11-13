"use client";

import { useMemo, useState } from "react";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import type { Selection } from "@/web/lib/topologySelection";
import { sessionsSince, type RoamSession } from "@/web/lib/roamingHistory";
import { backhaulRadios, laneSessions, summariseLanes, type BackhaulRadio } from "@/web/lib/backhaulHistory";
import { useRoamingHistories } from "@/web/lib/useRoamingHistory";
import { DetailSection, JumpButton, apLabel } from "./DetailParts";
import { RoamingTimeline, shortDuration } from "./RoamingTimeline";
import { CountRows, HistoryLoading, PeriodSwitch, SessionList, TimeShare, apColours, countText, rangeText } from "./RoamingParts";

type Lane = { radio: BackhaulRadio; sessions: RoamSession[] };

const signalText = (s: RoamSession) =>
  s.joinRssi == null ? null : s.minRssi != null && s.minRssi < s.joinRssi ? `${s.joinRssi} dBm, lowest ${s.minRssi}` : `${s.joinRssi} dBm`;

/**
 * AP panel "Backhaul history" for a Beacon that back-hauls (or has back-hauled) over WiFi: which
 * parent AP each of its backhaul radios was joined to over 1 / 7 / 14 days, from Corteca's
 * per-station history of the backhaul stations (one per radio) — read when the panel opens.
 */
export function BackhaulHistory({ network, ap, onSelect }: {
  network: McpNetwork;
  ap: McpAccessPoint;
  onSelect: (sel: Selection) => void;
}) {
  const gateway = network.aps.find((a) => a.role === "root");
  const uplink = network.backhaul.find((l) => l.childMac === ap.mac);
  const radios = useMemo(() => backhaulRadios(ap, uplink), [ap, uplink]);
  const states = useRoamingHistories(gateway?.mac ?? null, radios.map((r) => r.staMac), network.capturedAt);
  const [days, setDays] = useState(7);

  // MLO: the MLD history is the record (counted); the radios' own histories only add sparse
  // single-link polls, shown as extra bars. Without MLO (or an empty MLD history) the radios count.
  const { all, mloUsed } = useMemo(() => {
    const mld = radios.find((r) => r.mlo);
    const mldState = mld && states[mld.staMac];
    const mloUsed = mldState?.status === "ready" && mldState.history.events.length > 0;
    const all = radios.flatMap((radio): (Lane & { to: number })[] => {
      const st = states[radio.staMac];
      if (st?.status !== "ready" || (radio.mlo && !mloUsed)) return [];
      return [{ radio, to: st.history.to, sessions: laneSessions(st.history, radio, network, uplink, mloUsed ? !!radio.mlo : true) }];
    });
    return { all, mloUsed };
  }, [radios, states, network, uplink]);

  if (!gateway || ap.role === "root" || radios.length === 0) return null;

  const loading = radios.some((r) => (states[r.staMac]?.status ?? "loading") === "loading");
  const ready = !loading && all.length > 0;
  const to = ready ? Math.max(...all.map((l) => l.to)) : Date.now();
  const from = to - days * 86_400_000;
  const lanes: Lane[] = all.map((l) => ({ radio: l.radio, sessions: sessionsSince(l.sessions, from) }));
  const counted = lanes.filter((l) => !!l.radio.mlo === mloUsed);
  const extra = mloUsed ? lanes.filter((l) => !l.radio.mlo && l.sessions.length > 0) : [];
  const summary = summariseLanes(counted.map((l) => l.sessions));
  const connections = counted.flatMap((l) => l.sessions.map((s, i) => ({ lane: l, s, i }))).sort((a, b) => b.s.start - a.s.start);
  const now = connections.find((c) => c.s.endedBy.kind === "ongoing");
  const bars = [...counted, ...extra];
  const lastBar = bars.map((l) => l.sessions.length > 0).lastIndexOf(true);
  const colourOf = apColours(summary.timePerAp);
  const apOf = (mac: string) => network.aps.find((a) => a.mac === mac);
  const labelOf = (mac: string) => { const a = apOf(mac); return a ? apLabel(a) : mac; };
  const apLink = (mac: string) => {
    const a = apOf(mac);
    return a ? <JumpButton onClick={() => onSelect({ kind: "ap", id: a.mac })}>{apLabel(a)}</JumpButton> : <span className="font-mono">{mac}</span>;
  };
  const endText = (lane: Lane, s: RoamSession, i: number) => {
    const next = lane.sessions[i + 1];
    switch (s.endedBy.kind) {
      case "roamed": return next && next.ap !== s.ap ? `Moved to ${labelOf(next.ap)}` : "Rejoined";
      case "disconnected":
        return next
          ? `Dropped · rejoined ${next.ap !== s.ap ? labelOf(next.ap) : "the same parent"} ${shortDuration(next.start - s.end)} later`
          : "Dropped";
      case "apOff": return "Parent AP or gateway switched off";
      case "ongoing": return s.live ? "Connected now (from live data — the rejoin isn't in Corteca's history)" : "Connected now";
    }
  };
  const detail = (s: RoamSession) => [s.band, s.channel != null && s.channel > 0 && `Ch ${s.channel}`, signalText(s)].filter(Boolean).join(" · ");

  return (
    <DetailSection
      title="Backhaul history" plain
      actions={<PeriodSwitch days={days} onChange={setDays} />}
      summary={!ready ? "Parent APs this Beacon's backhaul joined, from Corteca's history"
        : [countText(summary.apMoves, "parent change"), countText(summary.disconnects, "drop"), now && `on ${labelOf(now.s.ap)} now`, rangeText(days)].filter(Boolean).join(" · ")}
    >
      {loading && <HistoryLoading />}
      {!ready && !loading && <p className="text-xs text-neutral-500">Couldn&apos;t read this Beacon&apos;s backhaul history from Corteca.</p>}
      {ready && (
        <>
          {bars.map((l, li) => (
            <div key={l.radio.staMac}>
              {li === counted.length && (
                <p className="mb-1.5 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
                  Single-link joins Corteca also logged per radio — not counted below
                </p>
              )}
              <div className="mb-1 flex justify-between gap-2 text-[11px]">
                <span className="font-semibold text-neutral-700">{l.radio.mlo ? `MLO backhaul · ${l.radio.band}` : `${l.radio.band} backhaul`}</span>
                <span className="font-mono text-neutral-400">{l.radio.staMac}</span>
              </div>
              {l.sessions.length > 0 ? (
                <RoamingTimeline
                  sessions={l.sessions} from={from} to={to} colourOf={colourOf} labelOf={labelOf} axis={li === lastBar}
                  linesOf={(s) => [detail(s), endText(l, s, l.sessions.indexOf(s))]}
                />
              ) : (
                <p className="mb-3 text-[11px] text-neutral-500">Not joined to any AP in this period.</p>
              )}
            </div>
          ))}
          <CountRows rows={[
            { label: "Parent changes", value: summary.apMoves },
            { label: "Drops", value: summary.disconnects },
          ]} />
          {summary.timePerAp.length > 0 && (
            <TimeShare
              title="Time on each parent"
              caption="share of joined time · total"
              rows={summary.timePerAp} colourOf={colourOf} renderAp={apLink}
            />
          )}
          <SessionList
            colourOf={colourOf} renderAp={apLink}
            items={connections.map(({ lane, s, i }) => ({
              key: `${lane.radio.staMac}-${s.start}-${s.ap}`,
              session: s,
              tags: s.roam ? [{ text: "Moved", tone: "blue" as const }] : undefined,
              lines: [detail(s), endText(lane, s, i)],
            }))}
          />
          <p className="mt-2 text-[10px] text-neutral-400">
            {mloUsed
              ? "From Corteca's connection history of this Beacon's multi-link (MLO) backhaul station; the signal is the strongest link's. Drops carry no reason."
              : "From Corteca's connection history of this Beacon's backhaul radios (one per band). Joins reported at exactly −75 dBm are shown without a signal (a fixed value, not a reading); drops carry no reason."}
          </p>
        </>
      )}
    </DetailSection>
  );
}
