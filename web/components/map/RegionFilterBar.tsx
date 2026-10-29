"use client";

import { MultiSelectMenu } from "@/web/components/map/MultiSelectMenu";
import {
  SUBDIVIDED, isFiltering, EMPTY_REGION_FILTER,
  type RegionFilter, type filterOptions,
} from "@/web/lib/regionFilter";

interface Props {
  filter: RegionFilter;
  options: ReturnType<typeof filterOptions>;
  /** The page drops picks the new higher levels no longer allow (`pruneFilter`). */
  onChange: (f: RegionFilter) => void;
  /** Still working out regions for located networks. */
  pending: boolean;
}

/** Continent → country → (US / Canada) state or province filters above the fleet map. */
export function RegionFilterBar({ filter, options, onChange, pending }: Props) {
  const set = (patch: Partial<RegionFilter>) => onChange({ ...filter, ...patch });

  const subdivided = SUBDIVIDED.filter((c) => filter.countries.includes(c));
  const regionLabel = subdivided.length === 2 ? "State / province" : subdivided[0] === "CA" ? "Province / territory" : "State";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <MultiSelectMenu
        label="Continent" allLabel="All continents"
        options={options.continents} value={filter.continents}
        onChange={(continents) => set({ continents })} disabled={pending && options.continents.length === 0}
      />
      <MultiSelectMenu
        label="Country" allLabel="All countries"
        options={options.countries} value={filter.countries}
        onChange={(countries) => set({ countries })} disabled={pending && options.countries.length === 0}
      />
      {subdivided.length > 0 && (
        <MultiSelectMenu
          label={regionLabel} allLabel={subdivided.length === 2 ? "All states and provinces" : `All of ${options.countries.find((o) => o.value === subdivided[0])?.label ?? subdivided[0]}`}
          options={options.regions} value={filter.regions}
          onChange={(regions) => set({ regions })}
        />
      )}
      {isFiltering(filter) && (
        <button
          type="button" onClick={() => onChange(EMPTY_REGION_FILTER)}
          className="rounded-lg px-2 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
