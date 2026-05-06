// Utilities for enriching performance-report tables with subscriber Account Names.
// Used by both the generic report page and the reboot-report page.

const MAC_RE = /^[0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}$/;

// Column names checked in priority order for MAC-based device lookup
const MAC_COLS = [
  'home_wifi_id', 'Home WiFi ID', 'device_id', 'Device ID',
  'ap_id', 'AP ID', 'mac', 'MAC', 'mac_address',
];

// Column names checked in priority order for serial-number-based lookup
const SERIAL_COLS = [
  'serial_no', 'serial_number', 'Serial Number', 'Serial No', 'SN',
];

export type LookupField = 'device_id' | 'serial_no';

export interface DeviceIdInfo {
  col: string;
  lookupField: LookupField;
  normalizeId: (raw: string) => string;
}

/** Inspect the first few rows to find the best column for subscriber lookup. */
export function findDeviceIdInfo(rows: Record<string, string>[]): DeviceIdInfo | null {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  const findCol = (name: string) => cols.find((c) => c.toLowerCase() === name.toLowerCase());
  const samples = (col: string) => rows.slice(0, 10).map((r) => r[col]).filter(Boolean);

  // Priority: named MAC-like columns
  for (const candidate of MAC_COLS) {
    const col = findCol(candidate);
    if (col && samples(col).some((v) => MAC_RE.test(v.trim()))) {
      return { col, lookupField: 'device_id', normalizeId: (id) => id.trim().toUpperCase().replace(/:/g, '-') };
    }
  }

  // Fallback: any column whose values all look like MACs
  for (const col of cols) {
    const s = samples(col);
    if (s.length >= 2 && s.every((v) => MAC_RE.test(v.trim()))) {
      return { col, lookupField: 'device_id', normalizeId: (id) => id.trim().toUpperCase().replace(/:/g, '-') };
    }
  }

  // Fallback: serial number columns
  for (const candidate of SERIAL_COLS) {
    const col = findCol(candidate);
    if (col && samples(col).length > 0) {
      return { col, lookupField: 'serial_no', normalizeId: (id) => id.trim() };
    }
  }

  return null;
}

/** Prepend an "Account Name" key to each row that has a matching name. */
export function injectAccountNames(
  rows: Record<string, string>[],
  names: Map<string, string>,
  idInfo: DeviceIdInfo,
): Record<string, string>[] {
  return rows.map((row) => {
    const id = row[idInfo.col] ? idInfo.normalizeId(row[idInfo.col]) : '';
    const name = id ? names.get(id) : undefined;
    return name ? { 'Account Name': name, ...row } : row;
  });
}
