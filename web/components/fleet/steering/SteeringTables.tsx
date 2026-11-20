"use client";

import { useState } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { NetworkLink } from "@/web/components/fleet/rankingColumns";
import { FleetTable } from "@/web/components/tables/FleetTable";
import { fmtInt, prettyModel } from "@/web/lib/fleet/labels";
import type { SteeringResponse } from "@/web/lib/fleet/steering";

type NetRow = SteeringResponse["networkRows"][number];
type ClientRow = SteeringResponse["clientRows"][number];

function Rate({ v }: { v: number }) {
  return <StatusPill tone={v < 25 ? "poor" : v < 50 ? "fair" : "neutral"}>{v.toFixed(0)}%</StatusPill>;
}

/** Lowest-success networks and clients (networks open in the MCP visualizer). */
export function SteeringTables({ data }: { data: SteeringResponse }) {
  const [view, setView] = useState<"networks" | "clients">("networks");
  return (
    <CortecaCard
      title={view === "networks" ? "Networks by steering success" : "Clients steered least successfully"}
      info="Lowest success first. Attempts are within the selected range."
      actions={<SegmentedControl label="Show" value={view} onChange={setView} options={[{ value: "networks", label: "Networks" }, { value: "clients", label: "Clients" }]} />}
    >
      {view === "networks" ? (
        <FleetTable<NetRow>
          rows={data.networkRows}
          rowKey={(n) => n.networkId}
          maxHeight="max-h-[480px]"
          columns={[
            { key: "net", label: "Network", render: (n) => <NetworkLink id={n.networkId} />, sort: (n) => n.networkId },
            { key: "mesh", label: "Mesh", render: (n) => n.mesh, sort: (n) => n.mesh },
            { key: "clients", label: "Clients", numeric: true, render: (n) => fmtInt(n.clients), sort: (n) => n.clients },
            { key: "never", label: "At 0%", numeric: true, render: (n) => fmtInt(n.never), sort: (n) => n.never },
            { key: "avg", label: "Avg success", numeric: true, render: (n) => <Rate v={n.avg} />, sort: (n) => n.avg },
            { key: "attempts", label: "Attempts", numeric: true, render: (n) => fmtInt(n.attempts), sort: (n) => n.attempts },
          ]}
        />
      ) : (
        <FleetTable<ClientRow>
          rows={data.clientRows}
          rowKey={(c) => `${c.networkId}:${c.mac}`}
          maxHeight="max-h-[480px]"
          columns={[
            { key: "client", label: "Client", render: (c) => <span>{c.name || <span className="font-mono text-xs">{c.mac}</span>}</span>, sort: (c) => c.name || c.mac },
            { key: "net", label: "Network", render: (c) => <NetworkLink id={c.networkId} />, sort: (c) => c.networkId },
            { key: "ap", label: "AP model", render: (c) => prettyModel(c.apModel), sort: (c) => c.apModel },
            { key: "rate", label: "Success", numeric: true, render: (c) => <Rate v={c.success} />, sort: (c) => c.success },
            { key: "attempts", label: "Attempts", numeric: true, render: (c) => fmtInt(c.attempts), sort: (c) => c.attempts },
            { key: "not", label: "Not moved", numeric: true, render: (c) => fmtInt(c.notMoved), sort: (c) => c.notMoved },
            { key: "2g", label: "To 2.4 GHz", numeric: true, render: (c) => fmtInt(c.moved2g), sort: (c) => c.moved2g },
          ]}
        />
      )}
    </CortecaCard>
  );
}
