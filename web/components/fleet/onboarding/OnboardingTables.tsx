"use client";

import { useState } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { ConsoleMac } from "@/web/components/fleet/rankingColumns";
import { FleetTable } from "@/web/components/tables/FleetTable";
import { fmtInt } from "@/web/lib/fleet/labels";
import type { Claimable, FailedClaim, OnboardingResponse, Unauthenticated } from "@/web/lib/fleet/onboarding";

type View = "claims" | "claimable" | "unauth";

const when = (iso: string) => (iso ? new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`).toLocaleString() : "—");

/** Failed claims / WiFi points waiting to be claimed / unauthenticated WiFi points, one at a time. */
export function OnboardingTables({ data, since }: { data: OnboardingResponse; since: string }) {
  const [view, setView] = useState<View>("claims");
  return (
    <CortecaCard
      title={view === "claims" ? "Failed claims" : view === "claimable" ? "Waiting to be claimed" : "Unauthenticated WiFi points"}
      info={view === "claims" ? "Newest first; rows within the selected range are highlighted." : view === "unauth" ? "WiFi points whose connection to provisioning failed authentication, newest first (Corteca returns at most 5,000 here)." : undefined}
      actions={<SegmentedControl label="Show" value={view} onChange={setView} options={[
        { value: "claims", label: "Failed claims" }, { value: "claimable", label: "Waiting" }, { value: "unauth", label: "Unauthenticated" },
      ]} />}
    >
      {view === "claims" && (
        <FleetTable<FailedClaim>
          rows={data.failedClaims} rowKey={(c) => c.subscriberId} tinted={(c) => c.last >= since} maxHeight="max-h-[420px]" empty="No failed claims."
          columns={[
            { key: "sub", label: "Subscriber", render: (c) => c.subscriberId, sort: (c) => c.subscriberId },
            { key: "n", label: "Failed attempts", numeric: true, render: (c) => fmtInt(c.attempts), sort: (c) => c.attempts },
            { key: "first", label: "First", render: (c) => when(c.first), sort: (c) => c.first },
            { key: "last", label: "Last", render: (c) => when(c.last), sort: (c) => c.last },
          ]}
        />
      )}
      {view === "claimable" && (
        <FleetTable<Claimable>
          rows={data.claimable} rowKey={(c) => c.deviceId} maxHeight="max-h-[420px]" empty="Nothing is waiting to be claimed."
          columns={[
            { key: "dev", label: "WiFi point", render: (c) => <ConsoleMac mac={c.deviceId} />, sort: (c) => c.deviceId },
            { key: "how", label: "Claim by", render: (c) => c.claimTypes || "—", sort: (c) => c.claimTypes },
          ]}
        />
      )}
      {view === "unauth" && (
        <FleetTable<Unauthenticated>
          rows={data.unauthenticated} rowKey={(u, i) => `${u.mac}:${i}`} maxHeight="max-h-[420px]" limit={300} empty="No unauthenticated WiFi points."
          columns={[
            { key: "mac", label: "WiFi point", render: (u) => <span className="font-mono text-xs">{u.mac}</span>, sort: (u) => u.mac },
            { key: "seen", label: "First seen", render: (u) => when(u.firstSeen), sort: (u) => u.firstSeen },
            { key: "ip", label: "IP address", render: (u) => <span className="font-mono text-xs">{u.ip || "—"}</span>, sort: (u) => u.ip },
          ]}
        />
      )}
    </CortecaCard>
  );
}
