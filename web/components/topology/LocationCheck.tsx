"use client";

import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import type { LatLng } from "@/web/lib/networkLocation";
import { compareLocations, type Detected, type Stored } from "./useGatewayLocation";

export type LocationSource = "detected" | "corteca";

const fmt = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
const metres = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * Compares Corteca's stored gateway location with what Corteca's Autodetect finds now (both
 * read-only; nothing is saved). A difference is flagged, and the map can show either position.
 */
export function LocationCheck({ stored, detected, source, onSource }: {
  stored: Stored | undefined;
  detected: Detected | null | "error" | undefined;
  source: LocationSource;
  onSource: (s: LocationSource) => void;
}) {
  if (detected === undefined) return <p className="mb-2 text-xs text-neutral-500">Checking the location with Corteca&apos;s Autodetect…</p>;
  if (detected === "error") return <p className="mb-2 text-xs text-neutral-500">Couldn&apos;t check the location: Corteca&apos;s Autodetect didn&apos;t answer.</p>;
  if (detected === null) return <p className="mb-2 text-xs text-neutral-500">Corteca&apos;s Autodetect found no location for this gateway.</p>;
  const cmp = compareLocations(stored, detected);
  if (!cmp) return null;
  const acc = detected.accuracy != null ? ` (accuracy ${Math.round(detected.accuracy)} m)` : "";

  if (!cmp.differs) {
    return (
      <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-600">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Matches Corteca&apos;s Autodetect{cmp.distance != null && ` · ${metres(cmp.distance)} apart`}{acc}
      </p>
    );
  }
  return (
    <div role="status" className="mb-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-900 ring-1 ring-yellow-200">
      <p className="font-semibold">Location differs from Corteca</p>
      <p className="mt-0.5">
        Autodetect finds {fmt(detected)}{acc}
        {stored && stored !== "error"
          ? <>, {metres(cmp.distance ?? 0)} from Corteca&apos;s stored {fmt(stored)}.</>
          : <>; Corteca has no stored location.</>}
        {" "}Shown here only; Corteca isn&apos;t changed.
      </p>
      {stored && stored !== "error" && (
        <div className="mt-2">
          <SegmentedControl
            label="Position on the map" value={source} onChange={onSource}
            options={[{ value: "detected", label: "Detected" }, { value: "corteca", label: "Corteca stored" }]}
          />
        </div>
      )}
    </div>
  );
}
