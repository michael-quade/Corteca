"use client";

import { useMemo, useState } from "react";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import type { Selection } from "@/web/lib/topologySelection";
import {
  ROAMING_DAYS, roamSessions, sessionsSince, summarise, withLiveConnection, type LiveConnection, type RoamSession,
} from "@/web/lib/roamingHistory";
import { clientBand, clientLinks, clientSignalDbm } from "@/web/lib/clientFields";
import { useRoamingHistory } from "@/web/lib/useRoamingHistory";
import { reasonText } from "@/web/lib/clientInsights";
import { cn } from "@/web/lib/utils";
import { DetailSection, JumpButton, apLabel } from "./DetailParts";
import { RoamingTimeline, shortDuration, shortTime } from "./RoamingTimeline";

const RANGES = [1, 7, ROAMING_DAYS];
const LIST_LIMIT = 6;
// One colour per access point (not status colours); most-used AP first.
const AP_COLOURS = ["bg-violet-500", "bg-sky-500", "bg-indigo-300", "bg-fuchsia-400", "bg-slate-500", "bg-cyan-300"];

/** Where MCP has the client now. `connected_time` is seconds connected (MCP) or an ISO time (REST). */
function liveConnection(m: Member): LiveConnection | null {
  if (!m.connected || !m.device_id) return null;
  const ct = (m as { connected_time?: string | number }).connected_time;
  const secs = Number(ct);
  const since = ct == null || ct === "" ? null : Number.isFinite(secs) ? Date.now() - secs * 1000 : Date.parse(String(ct)) || null;
  const links = clientLinks(m);
  return {
    ap: m.device_id,
    band: links.length ? [...new Set(links.map((l) => l.band))].join(" + ") : clientBand(m),
    channel: links.length ? null : m.channel ?? null,
    since,
    rssi: clientSignalDbm(m),
  };
}

function signalText(s: RoamSession): string | null {
  if (s.joinRssi == null) return null;
  return s.minRssi != null && s.minRssi < s.joinRssi ? `${s.joinRssi} dBm, lowest ${s.minRssi}` : `${s.joinRssi} dBm`;
}

const connectionText = (s: RoamSession) =>
  [s.band, s.channel != null && s.channel > 0 && `Ch ${s.channel}`, signalText(s)].filter(Boolean).join(" · ");

/**
 * Client panel "Roaming history": which access points (and bands) the client was on over the last
 * 1 / 7 / 14 days, from Corteca's per-client association history — read when the panel opens.
 */
export function ClientRoaming({ network, member, onSelect }: {
  network: McpNetwork;
  member: Member;
  onSelect: (sel: Selection) => void;
}) {
  const gateway = network.aps.find((a) => a.role === "root");
  const state = useRoamingHistory(gateway?.mac ?? null, member.id, network.capturedAt);
  const [days, setDays] = useState(7);
  const [showAll, setShowAll] = useState(false);
  const all = useMemo(
    () => (state.status === "ready" ? withLiveConnection(roamSessions(state.history, gateway?.mac), liveConnection(member), state.history.to) : []),
    [state, gateway?.mac, member]
  );
  if (!gateway) return null;

  const to = state.status === "ready" ? state.history.to : Date.now();
  const from = to - days * 86_400_000;
  const sessions = sessionsSince(all, from);
  const summary = summarise(sessions);
  const colours = new Map(summary.timePerAp.map((t, i) => [t.ap, AP_COLOURS[i % AP_COLOURS.length]]));
  const colourOf = (mac: string) => colours.get(mac) ?? "bg-neutral-400";
  const ap = (mac: string) => network.aps.find((a) => a.mac === mac);
  const labelOf = (mac: string) => { const a = ap(mac); return a ? apLabel(a) : mac; };
  const apLink = (mac: string) => {
    const a = ap(mac);
    return a ? <JumpButton onClick={() => onSelect({ kind: "ap", id: a.mac })}>{apLabel(a)}</JumpButton> : <span className="font-mono">{mac}</span>;
  };
  const total = summary.timePerAp.reduce((n, t) => n + t.ms, 0) || 1;
  const newest = [...sessions].reverse();
  const listed = showAll ? newest : newest.slice(0, LIST_LIMIT);

  const endText = (s: RoamSession, i: number) => {
    const next = sessions[i + 1];
    switch (s.endedBy.kind) {
      case "roamed":
        return next ? `Moved to ${next.ap === s.ap ? next.band ?? "another band" : labelOf(next.ap)}` : "Moved";
      case "disconnected":
        return ["Disconnected", reasonText(s.endedBy.reasonCode)].filter(Boolean).join(" · ");
      case "apOff":
        return "Access point switched off";
      case "ongoing":
        return s.live ? "Connected now (from live data — the reconnect isn't in Corteca's history)" : "Connected now";
    }
  };

  return (
    <DetailSection
      title="Roaming history" plain
      actions={
        <div className="flex gap-1" role="group" aria-label="Period">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                days === d ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-neutral-500 hover:bg-neutral-100"
              )}
            >
              {d === 1 ? "24 h" : `${d} days`}
            </button>
          ))}
        </div>
      }
      summary={state.status !== "ready" ? "Access points and bands this client was on, from Corteca's history"
        : `${sessions.length} connection${sessions.length === 1 ? "" : "s"} · ${summary.apMoves} AP move${summary.apMoves === 1 ? "" : "s"} · ${summary.disconnects} disconnect${summary.disconnects === 1 ? "" : "s"} · ${days === 1 ? "24 h" : `${days} days`}`}
    >
      {state.status === "loading" && (
        <p className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
          Reading Corteca&apos;s history…
        </p>
      )}
      {state.status === "error" && <p className="text-xs text-neutral-500">Couldn&apos;t read this client&apos;s history from Corteca.</p>}
      {state.status === "ready" && sessions.length === 0 && (
        <p className="text-xs text-neutral-500">No WiFi connections recorded in this period.</p>
      )}

      {state.status === "ready" && sessions.length > 0 && (
        <>
          <RoamingTimeline
            sessions={sessions} from={from} to={to} colourOf={colourOf} labelOf={labelOf}
            linesOf={(s) => [connectionText(s), endText(s, sessions.indexOf(s))]}
          />
          <dl className="mb-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Moves between APs</dt>
              <dd className="font-medium text-neutral-800">{summary.apMoves}</dd>
            </div>
            {summary.bandMoves > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Band changes</dt>
                <dd className="font-medium text-neutral-800">{summary.bandMoves}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Disconnects</dt>
              <dd className="font-medium text-neutral-800">{summary.disconnects}</dd>
            </div>
          </dl>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 border-t border-neutral-100 pt-2 text-[11px]">
            <span className="font-semibold text-neutral-700">Time on each AP</span>
            <span className="text-neutral-400">share of connected time · total</span>
          </div>
          <dl className="mb-3 space-y-1.5 text-xs">
            {summary.timePerAp.map((t) => (
              <div key={t.ap} className="flex items-center justify-between gap-3">
                <dt className="flex min-w-0 items-center gap-1.5 text-neutral-500">
                  <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", colourOf(t.ap))} />
                  <span className="truncate">{apLink(t.ap)}</span>
                </dt>
                <dd className="flex-shrink-0 font-medium text-neutral-800">
                  {`${Math.round((t.ms / total) * 100)}% · ${shortDuration(t.ms)}`}
                </dd>
              </div>
            ))}
          </dl>

          <ol className="-mx-2 space-y-0.5">
            {listed.map((s) => {
              const i = sessions.indexOf(s);
              return (
                <li key={`${s.start}-${s.ap}`} className="rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                  <div className="flex justify-between gap-2 text-[11px] text-neutral-500">
                    <span>{s.startedBefore ? `Before ${shortTime(s.start)}` : shortTime(s.start)}</span>
                    <span>{shortDuration(s.end - s.start)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-800">
                    <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", colourOf(s.ap))} />
                    {apLink(s.ap)}
                    {s.roam && <span className="rounded-full bg-blue-50 px-1.5 text-[10px] font-medium text-blue-700">Roamed</span>}
                  </div>
                  <div className="text-[11px] text-neutral-600">{connectionText(s)}</div>
                  <div className="text-[11px] text-neutral-500">{endText(s, i)}</div>
                </li>
              );
            })}
          </ol>
          {newest.length > LIST_LIMIT && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              {showAll ? "Show fewer" : `Show all ${newest.length}`}
            </button>
          )}
          <p className="mt-2 text-[10px] text-neutral-400">From Corteca&apos;s connection history (signal sampled about hourly).</p>
        </>
      )}
    </DetailSection>
  );
}
