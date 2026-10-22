"use client";

import { useState } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { SubscriberSearch } from "@/web/components/SubscriberSearch";
import { subscriberKey, subscriberName } from "@/web/lib/subscriberSearch";
import { DataModelBrowser } from "@/web/components/DataModelBrowser";
import type { Subscriber } from "@/web/lib/corteca/types";
import { CortecaPage, CortecaLoading } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { StatusPill } from "@/web/components/corteca/StatusPill";

export default function DeviceBrowserPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selected, setSelected] = useState<Subscriber | null>(null);

  if (isLoading || !isAuthenticated) return <CortecaLoading />;

  const deviceId  = selected?.home_wifis?.[0]?.id;
  const online    = selected?.home_wifis?.[0]?.status?.online;
  const fullName  = selected
    ? subscriberName(selected)
    : null;

  return (
    <CortecaPage title="Device Data Model Browser" meta="Explore and configure the full USP data model for any managed device.">
      <CortecaCard title="Find a subscriber">
        <SubscriberSearch onSelect={setSelected} selectedKey={selected ? subscriberKey(selected) : undefined} />
      </CortecaCard>

      {selected && (
        <CortecaCard
          title={fullName}
          actions={deviceId && <StatusPill tone={online ? "good" : "neutral"}>{online ? "Online" : "Offline"}</StatusPill>}
        >
          <div className="-mt-3 mb-4 space-y-0.5">
            {selected.email && <p className="text-sm text-neutral-500">{selected.email}</p>}
            {deviceId && <p className="font-mono text-xs text-neutral-400">Device ID: {deviceId}</p>}
          </div>
          {deviceId ? (
            <DataModelBrowser deviceId={deviceId} />
          ) : (
            <p className="text-sm text-neutral-500">No device ID found for this subscriber.</p>
          )}
        </CortecaCard>
      )}
    </CortecaPage>
  );
}
