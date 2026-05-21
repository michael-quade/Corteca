"use client";

import { useEffect, useRef } from "react";
import type { DeviceMarker } from "@/app/api/network-map/locate/route";
import type { NetworkDeviceInfo } from "@/app/api/network-map/device-info/[mac]/route";

type L = typeof import("leaflet");

const CONSOLE_BASE = process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? 'https://console.demo2.homewifi.nokia.com';

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, '-')}`;
}

interface Props {
  devices: DeviceMarker[];
  progress: number;
  flyToTarget?: { lat: number; lng: number } | null;
  resetViewTrigger?: number;
  onPopupClose?: () => void;
}

function calcRadius(zoom: number): number {
  if (zoom <= 3)  return 5;
  if (zoom <= 5)  return 7;
  if (zoom <= 7)  return 9;
  if (zoom <= 10) return 12;
  return 16;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function basePopupHtml(d: DeviceMarker, detail: string): string {
  const name   = d.accountName || d.customerId || d.mac;
  const sub    = d.accountName && d.customerId ? d.customerId : '';
  const model  = d.model + (d.firmware ? ' · ' + d.firmware : '');
  const dot    = d.online ? '#22c55e' : '#ef4444';
  const status = d.online ? 'Online' : 'Offline';
  const url    = esc(consoleUrl(d.mac));
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-width:200px;font-size:12px;line-height:1.6">
    <p style="margin:0 0 1px;font-weight:700;font-size:13px">${esc(name)}</p>
    ${sub   ? `<p style="margin:0 0 3px;color:#888;font-size:11px">${esc(sub)}</p>` : ''}
    ${model ? `<p style="margin:0;color:#666;font-size:11px">${esc(model)}</p>` : ''}
    <hr style="margin:7px 0 5px;border:none;border-top:1px solid #ebebeb">
    ${detail}
    <hr style="margin:5px 0;border:none;border-top:1px solid #ebebeb">
    <p style="margin:0;display:flex;align-items:center;gap:5px;font-size:11px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot}"></span>
      ${status}
    </p>
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       style="display:inline-flex;align-items:center;gap:4px;margin-top:7px;padding:4px 10px;background:#3b82f6;color:#fff;font-size:11px;font-weight:600;border-radius:5px;text-decoration:none;white-space:nowrap">
      Launch Corteca
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/><path d="M8 1h3v3M11 1 6 6"/>
      </svg>
    </a>
  </div>`;
}

function loadingDetail(): string {
  return `<p style="margin:4px 0;color:#bbb;font-size:11px;text-align:center">Loading details…</p>`;
}

function richDetail(info: NetworkDeviceInfo): string {
  const apText = info.aps.length > 0
    ? info.aps.map((a) => `${a.count > 1 ? a.count + ' ' : ''}${esc(a.model)}`).join('<br>')
    : '—';
  return `<table style="border-collapse:collapse;width:100%;font-size:12px">
    <tr>
      <td style="color:#888;font-size:11px;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top">Access Points</td>
      <td style="font-weight:600;padding:2px 0">${apText}</td>
    </tr>
    <tr>
      <td style="color:#888;font-size:11px;padding:2px 8px 2px 0">Clients</td>
      <td style="font-weight:600;padding:2px 0">${info.clientCount}</td>
    </tr>
  </table>`;
}

export function GlobalNetworkMap({ devices, progress, flyToTarget, resetViewTrigger, onPopupClose }: Props) {
  const mountRef        = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<ReturnType<L["map"]> | null>(null);
  const LRef            = useRef<L | null>(null);
  const onlineGroupRef  = useRef<ReturnType<L["layerGroup"]> | null>(null);
  const offlineGroupRef = useRef<ReturnType<L["layerGroup"]> | null>(null);
  const addedRef        = useRef<Set<string>>(new Set());
  const boundsRef       = useRef<[number, number][]>([]);
  const markersRef      = useRef(new Map<string, ReturnType<L["circleMarker"]>>());
  const detailsRef      = useRef(new Map<string, NetworkDeviceInfo>());

  useEffect(() => {
    if (!mountRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mountRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(mountRef.current, { worldCopyJump: true }).setView([20, 10], 2);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map);

      onlineGroupRef.current  = L.layerGroup().addTo(map);
      offlineGroupRef.current = L.layerGroup().addTo(map);

      map.on('zoomend', () => {
        const r = calcRadius(map.getZoom());
        for (const m of markersRef.current.values()) m.setRadius(r);
      });

      const legend = new L.Control({ position: "bottomright" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div");
        div.innerHTML = `<div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-family:sans-serif;font-size:11px;line-height:1.8">
          <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e"></span>Online</div>
          <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444"></span>Offline</div>
        </div>`;
        return div;
      };
      legend.addTo(map);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null; LRef.current = null;
      onlineGroupRef.current = null; offlineGroupRef.current = null;
      markersRef.current.clear();
      addedRef.current.clear(); boundsRef.current = [];
    };
  }, []);


  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return;
    mapRef.current.flyTo([flyToTarget.lat, flyToTarget.lng], 13, { animate: true, duration: 1.2 });
  }, [flyToTarget]);

  useEffect(() => {
    if (!resetViewTrigger || !mapRef.current || boundsRef.current.length === 0) return;
    mapRef.current.fitBounds(boundsRef.current as [number, number][], { padding: [40, 40], maxZoom: 10, animate: true });
  }, [resetViewTrigger]);

  useEffect(() => {
    const L   = LRef.current;
    const map = mapRef.current;
    if (!L || !map || devices.length === 0) return;

    let added = false;
    for (const d of devices) {
      if (addedRef.current.has(d.mac)) continue;
      addedRef.current.add(d.mac);
      boundsRef.current.push([d.lat, d.lng]);

      const group = d.online ? onlineGroupRef.current : offlineGroupRef.current;
      if (!group) continue;

      const marker = L.circleMarker([d.lat, d.lng], {
        radius:      calcRadius(map.getZoom()),
        fillColor:   d.online ? '#22c55e' : '#ef4444',
        color:       'white',
        weight:      1.5,
        fillOpacity: 0.88,
      }).addTo(group);

      markersRef.current.set(d.mac, marker);

      marker.bindPopup(basePopupHtml(d, loadingDetail()), {
        maxWidth: 280, minWidth: 200, autoPan: true,
      });

      // Hover opens popup; click keeps it open until manually closed
      let clickedOpen = false;
      marker.on('mouseover', () => { if (!clickedOpen) marker.openPopup(); });
      marker.on('mouseout',  () => { if (!clickedOpen) marker.closePopup(); });
      marker.on('click',     () => { clickedOpen = true; marker.openPopup(); });
      marker.on('popupclose', () => {
        const wasClicked = clickedOpen;
        clickedOpen = false;
        if (wasClicked) onPopupClose?.();
      });

      // Lazy-load device details when popup opens; update content regardless of open state
      // so subsequent opens (hover or click) immediately show cached data.
      marker.on('popupopen', () => {
        const popup = marker.getPopup();
        if (!popup) return;
        const cached = detailsRef.current.get(d.mac);
        if (cached) { popup.setContent(basePopupHtml(d, richDetail(cached))); popup.update(); return; }

        void (async () => {
          try {
            const res = await fetch(`/api/network-map/device-info/${encodeURIComponent(d.mac)}`);
            if (res.ok) {
              const info = await res.json() as NetworkDeviceInfo;
              detailsRef.current.set(d.mac, info);
              popup.setContent(basePopupHtml(d, richDetail(info)));
              if (popup.isOpen()) popup.update();
            }
          } catch { /* leave loading state */ }
        })();
      });

      added = true;
    }

    if (added && boundsRef.current.length > 0) {
      map.fitBounds(boundsRef.current as [number, number][], { padding: [40, 40], maxZoom: 10 });
    }
  }, [devices]);

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-neutral-200" style={{ height: 600 }}>
      {progress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] h-1 bg-neutral-100">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
