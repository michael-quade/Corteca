"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { nicknameFor, type DeviceNames } from "@/web/lib/deviceNames";
import { RenameDeviceModal } from "@/web/components/modals/RenameDeviceModal";

export interface RenameTarget {
  mac: string;
  kind: "Beacon" | "client";
  /** Shown under the title: model / detected name and MAC. */
  description: string;
}

interface DeviceRenameValue {
  /** Only devices in the gateway's device map can be renamed. */
  canRename: (mac: string) => boolean;
  start: (target: RenameTarget) => void;
}

const DeviceRenameContext = createContext<DeviceRenameValue | null>(null);

/** Rename support for the MCP visualizer's panels; null outside the provider. */
export const useDeviceRename = () => useContext(DeviceRenameContext);

const key = (mac: string) => mac.toUpperCase().replace(/[:\-]/g, "");

export function DeviceRenameProvider({ networkId, names, onRenamed, children }: {
  networkId: string;
  names: DeviceNames | null;
  onRenamed: (mac: string, alias: string) => void;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<RenameTarget | null>(null);

  const save = useCallback(async (alias: string) => {
    if (!target) return;
    const res = await fetchWithAuth(`/api/network/${encodeURIComponent(networkId)}/device-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac: target.mac, alias }),
    });
    const body = (await res.json().catch(() => null)) as { alias?: string; error?: string } | null;
    if (!res.ok || typeof body?.alias !== "string") throw new Error(body?.error ?? `Rename failed (HTTP ${res.status})`);
    onRenamed(target.mac, body.alias);
  }, [networkId, target, onRenamed]);

  const value = useMemo<DeviceRenameValue>(() => ({
    canRename: (mac) => !!names?.has(key(mac)),
    start: setTarget,
  }), [names]);

  return (
    <DeviceRenameContext.Provider value={value}>
      {children}
      <RenameDeviceModal
        isOpen={!!target}
        onClose={() => setTarget(null)}
        kind={target?.kind ?? "client"}
        description={target?.description ?? ""}
        currentAlias={target ? nicknameFor(names, target.mac) ?? "" : ""}
        onSave={save}
      />
    </DeviceRenameContext.Provider>
  );
}
