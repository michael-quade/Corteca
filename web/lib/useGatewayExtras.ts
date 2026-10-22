"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { toDeviceNames, withAlias, type DeviceNames } from "@/web/lib/deviceNames";
import { sanitiseWifiDetails, type WifiDetails } from "@/web/lib/wifiDetails";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";

/**
 * Data the MCP payload lacks, read from the gateway's own data model after each
 * MCP load: user-given names, WiFi details (radios, standards) and live Ethernet
 * ports (for inferring switches). All are optional — on failure the MCP-only view stays. A refresh of the same network
 * keeps the previous values until the new ones arrive; a different network clears them.
 */
export function useGatewayExtras(networkId: string | null, snapshot: unknown): {
  names: DeviceNames | null;
  wifi: WifiDetails | null;
  ports: EthernetPort[] | null;
  /** Apply a nickname saved on the gateway without re-reading the device map. */
  setNickname: (mac: string, alias: string) => void;
} {
  const [names, setNames] = useState<DeviceNames | null>(null);
  const [wifi, setWifi] = useState<WifiDetails | null>(null);
  const [ports, setPorts] = useState<EthernetPort[] | null>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (lastId.current !== networkId) { setNames(null); setWifi(null); setPorts(null); }
    lastId.current = networkId;
    if (!networkId || !snapshot) return;
    let cancelled = false;
    const base = `/api/network/${encodeURIComponent(networkId)}`;

    fetchWithAuth(`${base}/device-names`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { devices?: Parameters<typeof toDeviceNames>[0] } | null;
        if (!cancelled && r.ok && body?.devices) setNames(toDeviceNames(body.devices));
      })
      .catch(() => { /* names are optional */ });

    fetchWithAuth(`${base}/wifi-details`)
      .then(async (r) => {
        const details = r.ok ? sanitiseWifiDetails(await r.json().catch(() => null)) : null;
        if (!cancelled && details) setWifi(details);
      })
      .catch(() => { /* details are optional */ });

    fetchWithAuth(`${base}/ethernet`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { ports?: unknown } | null;
        if (!cancelled && r.ok && Array.isArray(body?.ports) && body.ports.length) setPorts(body.ports as EthernetPort[]);
      })
      .catch(() => { /* ports are optional: switches then come from Corteca's wired clients only */ });

    return () => { cancelled = true; };
  }, [networkId, snapshot]);

  const setNickname = useCallback((mac: string, alias: string) => setNames((n) => withAlias(n, mac, alias)), []);

  return { names, wifi, ports, setNickname };
}
