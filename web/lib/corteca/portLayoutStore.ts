// Server-side store of per-model Ethernet port layouts (PortLayout table + memory).
// Written when a gateway's live ports are read; read by the visualizers for mesh
// Beacons, which don't report their own ports.

import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import { displayModel, isLayoutPorts, layoutFromLive, modelKey, sameLayout, type PortLayout, type PortLayoutSource } from "@/web/lib/portLayouts";

const TTL_MS = 5 * 60_000;
let cache: { at: number; layouts: Map<string, PortLayout> } | null = null;

async function db() {
  return process.env.DATABASE_URL ? (await import("@/web/lib/prisma")).prisma : null;
}

function fromRow(r: { model: string; displayName: string; hardwareVersion: string; ports: unknown; source: string; sampleMac: string; updatedAt: Date }): PortLayout | null {
  if (!isLayoutPorts(r.ports)) return null;
  const source = (["live", "documentation", "manual"].includes(r.source) ? r.source : "live") as PortLayoutSource;
  return { model: r.model, displayName: r.displayName, hardwareVersion: r.hardwareVersion, ports: r.ports, source, sampleMac: r.sampleMac, updatedAt: r.updatedAt.toISOString() };
}

export async function getPortLayouts(): Promise<PortLayout[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return [...cache.layouts.values()];
  const layouts = new Map(cache?.layouts ?? []);
  const client = await db();
  let at = Date.now();
  if (client) {
    try {
      for (const row of await client.portLayout.findMany()) {
        const l = fromRow(row);
        if (l) layouts.set(l.model, l);
      }
    } catch (e) {
      // Table not pushed yet / DB unreachable: serve what this process learned, retry in a minute.
      console.warn("[port-layouts] DB read failed:", e instanceof Error ? e.message.split("\n")[0] : e);
      at -= TTL_MS - 60_000;
    }
  }
  cache = { at, layouts };
  return [...layouts.values()];
}

/** Save the layout a gateway reported live, if it is new or changed for that model. */
export async function recordLivePortLayout(model: string, hardwareVersion: string, mac: string, ports: EthernetPort[]): Promise<void> {
  const key = modelKey(model);
  if (!key || !ports.length) return;
  const layoutPorts = layoutFromLive(ports);
  const known = (await getPortLayouts().catch(() => [])).find((l) => l.model === key);
  if (known?.source === "live" && sameLayout(known.ports, layoutPorts)) return;

  const layout: PortLayout = {
    model: key, displayName: displayModel(model), hardwareVersion, ports: layoutPorts,
    source: "live", sampleMac: mac, updatedAt: new Date().toISOString(),
  };
  cache?.layouts.set(key, layout);
  const client = await db();
  if (!client) return;
  const data = { displayName: layout.displayName, hardwareVersion, ports: JSON.parse(JSON.stringify(layoutPorts)), source: "live", sampleMac: mac };
  await client.portLayout.upsert({ where: { model: key }, create: { model: key, ...data }, update: data });
  console.log(`[port-layouts] learned ${layout.displayName}: ${layoutPorts.length} ports (from ${mac})`);
}
