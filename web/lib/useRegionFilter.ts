"use client";

import { useCallback, useMemo, useState } from "react";
import { useNetworkRegions } from "@/web/lib/useNetworkRegions";
import {
  EMPTY_REGION_FILTER, describeFilter, filterOptions, isFiltering, matchesRegion, pruneFilter,
  type RegionFilter,
} from "@/web/lib/regionFilter";

/** Region filter state for the fleet map: the networks it lets through and the menu options. */
export function useRegionFilter<D extends { mac: string; lat: number; lng: number }>(devices: D[]) {
  const regions = useNetworkRegions(devices);
  const [filter, setFilterState] = useState<RegionFilter>(EMPTY_REGION_FILTER);

  const regionList = useMemo(() => devices.map((d) => regions.get(d.mac)), [devices, regions]);
  const options = useMemo(() => filterOptions(regionList, filter), [regionList, filter]);
  const setFilter = useCallback(
    (next: RegionFilter) => setFilterState(pruneFilter(next, filterOptions(regionList, next))),
    [regionList],
  );

  const active = isFiltering(filter);
  const shown = useMemo(
    () => (active ? devices.filter((d) => matchesRegion(regions.get(d.mac), filter)) : devices),
    [active, devices, regions, filter],
  );
  /** MACs that pass, or null when no filter is set (unlocated networks then stay in the table). */
  const macs = useMemo(() => (active ? new Set(shown.map((d) => d.mac)) : null), [active, shown]);

  return {
    filter, setFilter, options, shown, macs,
    pending: devices.some((d) => !regions.has(d.mac)),
    summary: active ? describeFilter(filter, options) : "",
  };
}
