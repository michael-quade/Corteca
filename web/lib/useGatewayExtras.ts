"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { toDeviceNames, withAlias, type DeviceNames } from "@/web/lib/deviceNames";
import { sanitiseWifiDetails, type WifiDetails } from "@/web/lib/wifiDetails";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import { readGatewayPorts } from "@/web/components/topology/useGatewayPorts";
import type { WanInfo } from "@/web/lib/wanInfo";

/**
 * Data the MCP payload lacks, read from the gateway's own data model after each
 * MCP load: user-given names, WiFi details (radios, standards) and live Ethernet
 * ports (for inferring switches), and the WAN connection. All are optional — on failure the MCP-only view stays. A refresh of the same network
 * keeps the previous values until the new ones arrive; a different network clears them.
 */
export function useGatewayExtras(networkId: string | null, snapshot: unknown): {
  names: DeviceNames | null;
  wifi: WifiDetails | null;
  ports: EthernetPort[] | null;
  /** null while loading, "error" when the gateway didn't answer. */
  wan: WanInfo | "error" | null;
  /** Apply a nickname saved on the gateway without re-reading the device map. */
  setNickname: (mac: string, alias: string) => void;
} {
  const [names, setNames] = useState<DeviceNames | null>(null);
  const [wifi, setWifi] = useState<WifiDetails | null>(null);
  const [ports, setPorts] = useState<EthernetPort[] | null>(null);
  const [wan, setWan] = useState<WanInfo | "error" | null>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (lastId.current !== networkId) { setNames(null); setWifi(null); setPorts(null); setWan(null); }
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

    // Shared with the AP panels' read; ports are optional: switches then come from Corteca's wired clients only.
    void readGatewayPorts(networkId, null).then((r) => { if (!cancelled && r !== "error") setPorts(r); });

    fetchWithAuth(`${base}/wan`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { wan?: WanInfo } | null;
        if (!cancelled) setWan(r.ok && body?.wan ? body.wan : "error");
      })
      .catch(() => { if (!cancelled) setWan("error"); });

    return () => { cancelled = true; };
  }, [networkId, snapshot]);

  const setNickname = useCallback((mac: string, alias: string) => setNames((n) => withAlias(n, mac, alias)), []);

  return { names, wifi, ports, wan, setNickname };
}
