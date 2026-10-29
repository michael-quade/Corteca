// Continent / country / state-province filter for the fleet Network Map (client + server safe).

export interface GeoRegion {
  continent: string | null;
  /** ISO 3166-1 alpha-2, e.g. "US". */
  countryCode: string | null;
  country: string | null;
  /** "US-GA", "CA-ON" — only for the US and Canada. */
  regionCode: string | null;
  region: string | null;
}

export interface RegionFilter {
  continents: string[];
  countries: string[];   // country codes
  regions: string[];     // region codes
}

export const EMPTY_REGION_FILTER: RegionFilter = { continents: [], countries: [], regions: [] };

/** Countries whose states / provinces can be filtered, in list order. */
export const SUBDIVIDED = ["US", "CA"] as const;

export const UNKNOWN = "Unknown";

export interface FilterOption { value: string; label: string; count: number; group?: string }

export const isFiltering = (f: RegionFilter) => f.continents.length + f.countries.length + f.regions.length > 0;

const continentOf = (r: GeoRegion | undefined) => r?.continent ?? UNKNOWN;
const countryOf = (r: GeoRegion | undefined) => r?.countryCode ?? UNKNOWN;

const regionOf = (r: GeoRegion | undefined, country: string) => r?.regionCode ?? `${country}-${UNKNOWN}`;

/**
 * Whether a network matches. Picked states / provinces narrow the US and Canada to just
 * those (US + Canada + Arizona = Arizona only); other picked countries stay whole.
 */
export function matchesRegion(r: GeoRegion | undefined, f: RegionFilter): boolean {
  if (f.continents.length && !f.continents.includes(continentOf(r))) return false;
  const country = countryOf(r);
  if (f.countries.length && !f.countries.includes(country)) return false;
  if (f.regions.length && SUBDIVIDED.includes(country as never) && !f.regions.includes(regionOf(r, country))) return false;
  return true;
}

function tally<T>(items: T[], key: (t: T) => string, label: (t: T) => string) {
  const m = new Map<string, FilterOption>();
  for (const t of items) {
    const k = key(t);
    const o = m.get(k);
    if (o) o.count++; else m.set(k, { value: k, label: label(t), count: 1 });
  }
  return [...m.values()];
}

const byLabel = (a: FilterOption, b: FilterOption) =>
  a.value === UNKNOWN ? 1 : b.value === UNKNOWN ? -1 : a.label.localeCompare(b.label);

/** Menu options with network counts; each level counts only what the levels above it let through. */
export function filterOptions(regions: (GeoRegion | undefined)[], f: RegionFilter) {
  const continents = tally(regions, continentOf, continentOf).sort(byLabel);

  const inContinents = regions.filter((r) => !f.continents.length || f.continents.includes(continentOf(r)));
  const countries = tally(inContinents, countryOf, (r) => r?.country ?? UNKNOWN).sort((a, b) => {
    const pa = SUBDIVIDED.indexOf(a.value as never), pb = SUBDIVIDED.indexOf(b.value as never);
    if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return byLabel(a, b);
  });

  const subdivided = SUBDIVIDED.filter((c) => f.countries.includes(c));
  const regionOpts = subdivided.flatMap((c) => {
    const inCountry = inContinents.filter((r) => countryOf(r) === c);
    const name = inCountry[0]?.country ?? c;
    return tally(inCountry, (r) => regionOf(r, c), (r) => r?.region ?? UNKNOWN)
      .sort(byLabel)
      .map((o) => ({ ...o, group: subdivided.length > 1 ? name : undefined }));
  });

  return { continents, countries, regions: regionOpts };
}

/** Drop picks a higher level no longer allows (e.g. Ontario after Canada is unticked). */
export function pruneFilter(f: RegionFilter, opts: ReturnType<typeof filterOptions>): RegionFilter {
  const has = (list: FilterOption[], v: string) => list.some((o) => o.value === v);
  const countries = f.countries.filter((c) => has(opts.countries, c));
  const regions = f.regions.filter((r) => countries.includes(r.slice(0, 2)) && has(opts.regions, r));
  return countries.length === f.countries.length && regions.length === f.regions.length ? f : { ...f, countries, regions };
}

/** "Ontario, Québec", "3 countries" — for the filter summary line. */
export function describeFilter(f: RegionFilter, opts: ReturnType<typeof filterOptions>): string {
  const names = (list: FilterOption[], picked: string[], noun: string) =>
    picked.length === 0 ? null
      : picked.length <= 2 ? picked.map((v) => list.find((o) => o.value === v)?.label ?? v).join(", ")
      : `${picked.length} ${noun}`;
  return [
    names(opts.regions, f.regions, "states/provinces"),
    names(opts.countries, f.countries, "countries"),
    names(opts.continents, f.continents, "continents"),
  ].filter(Boolean)[0] ?? "";
}
