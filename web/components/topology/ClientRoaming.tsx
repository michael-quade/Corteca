"use client";

import { useMemo, useState } from "react";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import type { Selection } from "@/web/lib/topologySelection";
import {
  roamSessions, sessionsSince, summarise, withLiveConnection, type LiveConnection, type RoamSession,
} from "@/web/lib/roamingHistory";
import { clientBand, clientLinks, clientSignalDbm } from "@/web/lib/clientFields";
import { useRoamingHistory } from "@/web/lib/useRoamingHistory";
import { reasonText } from "@/web/lib/clientInsights";
import { DetailSection, JumpButton, apLabel } from "./DetailParts";
import { RoamingTimeline } from "./RoamingTimeline";
import { CountRows, HistoryLoading, PeriodSwitch, SessionList, TimeShare, apColours, countText, rangeText } from "./RoamingParts";

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
  const all = useMemo(
    () => (state.status === "ready" ? withLiveConnection(roamSessions(state.history, gateway?.mac), liveConnection(member), state.history.to) : []),
    [state, gateway?.mac, member]
  );
  if (!gateway) return null;

  const to = state.status === "ready" ? state.history.to : Date.now();
  const from = to - days * 86_400_000;
  const sessions = sessionsSince(all, from);
  const summary = summarise(sessions);
  const colourOf = apColours(summary.timePerAp);
  const ap = (mac: string) => network.aps.find((a) => a.mac === mac);
  const labelOf = (mac: string) => { const a = ap(mac); return a ? apLabel(a) : mac; };
  const apLink = (mac: string) => {
    const a = ap(mac);
    return a ? <JumpButton onClick={() => onSelect({ kind: "ap", id: a.mac })}>{apLabel(a)}</JumpButton> : <span className="font-mono">{mac}</span>;
  };

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
      actions={<PeriodSwitch days={days} onChange={setDays} />}
      summary={state.status !== "ready" ? "Access points and bands this client was on, from Corteca's history"
        : [countText(sessions.length, "connection"), countText(summary.apMoves, "AP move"), countText(summary.disconnects, "disconnect"), rangeText(days)].join(" · ")}
    >
      {state.status === "loading" && <HistoryLoading />}
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
          <CountRows rows={[
            { label: "Moves between APs", value: summary.apMoves },
            { label: "Band changes", value: summary.bandMoves, hideZero: true },
            { label: "Disconnects", value: summary.disconnects },
          ]} />
          <TimeShare title="Time on each AP" caption="share of connected time · total" rows={summary.timePerAp} colourOf={colourOf} renderAp={apLink} />
          <SessionList
            colourOf={colourOf} renderAp={apLink}
            items={[...sessions].reverse().map((s) => ({
              key: `${s.start}-${s.ap}`,
              session: s,
              tags: s.roam ? [{ text: "Roamed", tone: "blue" as const }] : undefined,
              lines: [connectionText(s), endText(s, sessions.indexOf(s))],
            }))}
          />
          <p className="mt-2 text-[10px] text-neutral-400">From Corteca&apos;s connection history (signal sampled about hourly).</p>
        </>
      )}
    </DetailSection>
  );
}
