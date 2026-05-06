"use client";

import { useEffect, useRef } from "react";
import type { NetworkTopologyData } from "./NetworkTopologyMap";
import { buildTree, flatNodes } from "@/web/lib/networkTopology";
import type { TreeNode } from "@/web/lib/networkTopology";
import { filterConnectedDevices } from "@/web/lib/networkMembers";

// ── Location extraction ───────────────────────────────────────────────────────

function extractLatLng(summary: unknown): { lat: number; lng: number } | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? undefined : x; };

  let lat = n(s.latitude ?? s.lat ?? s.Latitude);
  let lng = n(s.longitude ?? s.lng ?? s.lon ?? s.Longitude);

  if (lat === undefined || lng === undefined) {
    const loc = s.location ?? s.coordinates ?? s.gps ?? s.address;
    if (loc && typeof loc === "object") {
      const l = loc as Record<string, unknown>;
      lat = n(l.latitude ?? l.lat);
      lng = n(l.longitude ?? l.lng ?? l.lon);
    }
  }

  if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

// ── Marker HTML ───────────────────────────────────────────────────────────────
// Each marker: type label pill → router SVG (with LED status) → client count badge overlay

function markerHtml(isRoot: boolean, online: boolean, label: string, clientCount: number): string {
  const body    = isRoot ? "#3b82f6" : online ? "#6366f1" : "#9ca3af";
  const led     = online ? "#22c55e" : "#6b7280";
  const typeBg  = isRoot ? "#1d4ed8" : online ? "#4338ca" : "#6b7280";
  const typeLabel = isRoot ? "GATEWAY" : "MESH AP";

  const arcs = online
    ? `<path d="M-18,-46 A18,18 0 0,1 18,-46" fill="none" stroke="${body}" stroke-width="2.2" stroke-linecap="round" opacity="0.35"/>
       <path d="M-12,-52 A12,12 0 0,1 12,-52" fill="none" stroke="${body}" stroke-width="2.2" stroke-linecap="round" opacity="0.62"/>` : "";

  const rootRing = isRoot
    ? `<circle cx="0" cy="-13" r="22" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="3,2" opacity="0.4"/>`
    : "";

  const iconW = isRoot ? 44 : 36;
  const iconH = isRoot ? 70 : 58;

  const svgIcon = `
    <svg viewBox="-22 -64 44 70" width="${iconW}" height="${iconH}" xmlns="http://www.w3.org/2000/svg">
      ${rootRing}${arcs}
      <line x1="-10" y1="-24" x2="-12" y2="-36" stroke="${body}" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="10"  y1="-24" x2="12"  y2="-36" stroke="${body}" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="-18" y="-24" width="36" height="22" rx="5" fill="${body}"/>
      <circle cx="-7" cy="-13" r="3.5" fill="${led}"/>
      <circle cx="0"  cy="-13" r="3.5" fill="${led}"/>
      <circle cx="7"  cy="-13" r="3.5" fill="${led}"/>
      <rect x="-14" y="-2" width="28" height="5" rx="2.5" fill="${body}" opacity="0.55"/>
      <polygon points="0,10 -7,0 7,0" fill="${body}"/>
    </svg>`;

  const badgeBg    = clientCount > 0 ? "#0f172a" : "#d1d5db";
  const badgeColor = clientCount > 0 ? "white"   : "#6b7280";

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:default">
      <div style="background:${typeBg};color:white;font-size:8px;font-weight:800;font-family:sans-serif;padding:2px 7px;border-radius:4px;white-space:nowrap;letter-spacing:0.08em;box-shadow:0 1px 3px rgba(0,0,0,0.25)">${typeLabel}</div>
      <div style="position:relative">
        ${svgIcon}
        <div style="position:absolute;top:-4px;right:-10px;background:${badgeBg};color:${badgeColor};border-radius:9999px;min-width:17px;height:17px;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid white;font-family:sans-serif;padding:0 3px;box-shadow:0 1px 2px rgba(0,0,0,0.2)">${clientCount}</div>
      </div>
      <div style="font-size:9px;font-weight:600;font-family:sans-serif;color:#1e293b;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;text-align:center;text-shadow:0 0 3px white,0 0 3px white">${label}</div>
    </div>`;
}

// ── AP positions: root at center, beacons offset in a circle ─────────────────

function apMarkerPositions(
  nodes: TreeNode[],
  center: { lat: number; lng: number },
): Array<{ node: TreeNode; lat: number; lng: number }> {
  const R = 0.00018;
  return nodes.map((node, i) => {
    if (node.isRoot || nodes.length === 1) return { node, lat: center.lat, lng: center.lng };
    const angle = ((i - 1) / Math.max(nodes.length - 1, 1)) * 2 * Math.PI;
    return { node, lat: center.lat + R * Math.sin(angle), lng: center.lng + R * Math.cos(angle) };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { data: NetworkTopologyData }

export function NetworkMap({ data }: Props) {
  const mapRef   = useRef<ReturnType<typeof import("leaflet")["map"]> | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  const location = extractLatLng(data.summary);
  const tree     = buildTree(data.topology, data.networks, data.mesh, data.configs ?? {}, data.rootDeviceId);
  const apNodes  = flatNodes(tree);

  // Count connected clients per AP
  const devices     = filterConnectedDevices(data.members);
  const clientsPerAp = new Map<string, number>();
  for (const apNode of apNodes) clientsPerAp.set(apNode.id, 0);
  for (const d of devices) clientsPerAp.set(d.apId, (clientsPerAp.get(d.apId) ?? 0) + 1);

  useEffect(() => {
    if (!mountRef.current || !location) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mountRef.current || mapRef.current) return;
      const map = L.map(mountRef.current).setView([location.lat, location.lng], 16);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map);

      const positions = apMarkerPositions(apNodes, location);
      for (const { node, lat, lng } of positions) {
        const count = clientsPerAp.get(node.id) ?? 0;
        const iW = node.isRoot ? 54 : 46;
        const iH = node.isRoot ? 108 : 96;
        const icon = L.divIcon({
          html: markerHtml(node.isRoot, node.online, node.label, count),
          className: "",
          iconSize:   [iW, iH],
          iconAnchor: [iW / 2, iH - 10],
          popupAnchor: [0, -(iH - 10)],
        });
        const status = node.online ? "Online" : "Offline";
        const dot    = node.online ? "#22c55e" : "#9ca3af";
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;min-width:130px">
               <p style="margin:0 0 4px;font-weight:700;font-size:13px">${node.label}</p>
               <p style="margin:0 0 2px;font-size:11px;color:#555;display:flex;align-items:center;gap:5px">
                 <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot}"></span>${status}
               </p>
               <p style="margin:4px 0 0;font-size:11px;color:#555">${count} connected client${count !== 1 ? "s" : ""}</p>
             </div>`,
            { maxWidth: 200 }
          );
      }
    });

    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!location) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-400">
        No location data available for this network.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200" style={{ height: 480 }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
