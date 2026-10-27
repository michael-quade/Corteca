"use client";

import { useMemo } from "react";
import type { NetworkTopologyData } from "./NetworkTopologyMap";
import { buildTree, flatNodes } from "@/web/lib/networkTopology";
import { filterConnectedDevices } from "@/web/lib/networkMembers";
import { extractLatLng } from "@/web/lib/networkLocation";
import { LocationMap } from "@/web/components/map/LocationMap";
import type { LocationAp } from "@/web/components/map/ApMapPin";

/** REST visualizer "Network location": the gateway at its location with its Beacons around it. */
export function NetworkMap({ data }: { data: NetworkTopologyData }) {
  const location = extractLatLng(data.summary);

  const aps = useMemo<LocationAp[]>(() => {
    const nodes = flatNodes(buildTree(data.topology, data.networks, data.mesh, data.configs ?? {}, data.rootDeviceId));
    const clients = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    for (const d of filterConnectedDevices(data.members)) clients.set(d.apId, (clients.get(d.apId) ?? 0) + 1);
    return nodes.map((n) => ({ id: n.id, label: n.label, model: n.model, online: n.online, isRoot: n.isRoot, clients: clients.get(n.id) ?? 0 }));
  }, [data.topology, data.networks, data.mesh, data.configs, data.rootDeviceId, data.members]);

  if (!location) {
    return (
      <div className="flex h-[480px] xl:h-[800px] items-center justify-center rounded-xl bg-[#f5f7fa] text-sm text-neutral-500 ring-1 ring-neutral-200">
        No location data available for this network.
      </div>
    );
  }
  return <LocationMap location={location} aps={aps} className="h-[480px] xl:h-[800px]" />;
}
