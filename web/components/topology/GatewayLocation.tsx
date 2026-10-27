"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { McpAccessPoint, McpNetwork } from "@/web/lib/mcpNetwork";
import { osmUrl, type LatLng } from "@/web/lib/networkLocation";
import type { Selection } from "@/web/lib/topologySelection";
import { DetailSection } from "./DetailParts";

// MapLibre is only downloaded when a gateway or WAN panel opens.
const LocationMap = dynamic(() => import("@/web/components/map/LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-xl bg-neutral-100" />,
});

// Per gateway, for the page's lifetime: null = Corteca has no position, "error" = couldn't read it.
const cache = new Map<string, Promise<LatLng | null | "error">>();

function readLocation(mac: string): Promise<LatLng | null | "error"> {
  let p = cache.get(mac);
  if (!p) {
    p = fetchWithAuth(`/api/network/${encodeURIComponent(mac)}/location`)
      .then(async (r) => (r.ok ? ((await r.json()) as { location: LatLng | null }).location : "error" as const))
      .catch(() => "error" as const);
    p.then((v) => { if (v === "error") cache.delete(mac); });
    cache.set(mac, p);
  }
  return p;
}

/** Gateway / WAN panel "Location": mini-map of the gateway with its Beacons; a pin click selects that AP. */
export function GatewayLocation({ network, gateway, selectedId, onSelect }: {
  network: McpNetwork;
  gateway: McpAccessPoint;
  selectedId?: string;
  onSelect: (s: Selection) => void;
}) {
  const [loc, setLoc] = useState<LatLng | null | "error" | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setLoc(undefined);
    void readLocation(gateway.mac).then((v) => { if (!cancelled) setLoc(v); });
    return () => { cancelled = true; };
  }, [gateway.mac]);

  const aps = network.aps.map((a) => ({
    id: a.mac, label: a.nickname ?? (a.role === "root" ? a.model : `${a.model} · ${a.mac.slice(-5)}`), model: a.model, online: a.online, isRoot: a.role === "root", clients: a.clientCount,
  }));

  return (
    <DetailSection title="Location">
      {loc === undefined && <div className="h-56 animate-pulse rounded-xl bg-neutral-100" />}
      {loc === "error" && <p className="text-xs text-neutral-500">Location unavailable: Corteca didn&apos;t return the device summary.</p>}
      {loc === null && <p className="text-xs text-neutral-500">Corteca has no location for this gateway.</p>}
      {loc && loc !== "error" && (
        <>
          <LocationMap
            location={loc} aps={aps} compact className="h-56"
            selectedId={selectedId}
            onPinClick={(id) => onSelect({ kind: "ap", id })}
          />
          <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] text-neutral-400">
            <span>Beacons are drawn around the gateway.</span>
            <a href={osmUrl(loc)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-medium text-blue-600 hover:underline">
              Open in OpenStreetMap ↗
            </a>
          </p>
          {/* The compact map has no attribution control (it covered the Beacons), so credit the data here. */}
          <p className="mt-0.5 text-[10px] text-neutral-400">
            Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> contributors
            · <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenFreeMap</a>
            · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenMapTiles</a>
          </p>
        </>
      )}
    </DetailSection>
  );
}
