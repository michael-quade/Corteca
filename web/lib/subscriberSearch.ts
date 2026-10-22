// Subscriber search fields, as in the Corteca console's "Customer search".
// Client + server safe: the route builds Corteca queries from this, the search
// boxes use the field list and labels.
//
// GET /dashboard-bff/subscribers takes name, email, uuid (customer ID),
// device_id (MAC) and serial_no. Checked on demo2:
// - name, email: case-insensitive substring.
// - uuid: case-sensitive substring.
// - device_id: prefix of at least 4 octets, uppercase and hyphen-separated only
//   ("Invalid MAC …" otherwise). Also matches networks with no subscriber.
// - serial_no: uppercase prefix.
// - email with a "+" never matches (even URL-encoded), so we search the part
//   before the "+" and filter the results here.
import type { Subscriber } from "@/web/lib/corteca/types";

export type SearchField = "auto" | "name" | "email" | "customerId" | "mac" | "serial";

export const SEARCH_FIELDS: { id: SearchField; label: string }[] = [
  { id: "auto", label: "Auto detect" },
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "customerId", label: "Customer ID" },
  { id: "mac", label: "MAC" },
  { id: "serial", label: "Serial number" },
];

export function isSearchField(v: string | null): v is SearchField {
  return SEARCH_FIELDS.some((f) => f.id === v);
}

export function fieldLabel(field: SearchField): string {
  return SEARCH_FIELDS.find((f) => f.id === field)?.label ?? field;
}

/** "a4:fc:a1:2d" / "A4FCA12DF8A1" → "A4-FC-A1-2D"; null unless 4–6 whole octets. */
export function normaliseMac(q: string): string | null {
  const hex = q.trim().replace(/[:\-.\s]/g, "");
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 || hex.length < 8 || hex.length > 12) return null;
  return hex.toUpperCase().match(/../g)!.join("-");
}

const MAC_RE = /^[0-9a-f]{2}([:\-.][0-9a-f]{2}){3,5}$|^[0-9a-f]{12}$/i;
// Vendor ID (4 letters, e.g. ALCL) + hex with at least one digit, so names like "Johnbeef" stay names.
const SERIAL_RE = /^[a-z]{4}(?=[0-9a-f]*\d)[0-9a-f]{4,8}$/i;

/** Which field Auto detect searches; null = could be name, email or customer ID. */
export function detectField(q: string): Exclude<SearchField, "auto"> | null {
  const t = q.trim();
  if (MAC_RE.test(t)) return "mac";
  if (SERIAL_RE.test(t)) return "serial";
  if (t.includes("@")) return "email";
  return null;
}

export interface UpstreamQuery {
  field: Exclude<SearchField, "auto">;
  param: "name" | "email" | "uuid" | "device_id" | "serial_no";
  value: string;
  /** Keep only rows passing this (the API can't take the full value). */
  keep?: (s: Subscriber) => boolean;
}

export class SearchInputError extends Error {}

function queriesFor(field: Exclude<SearchField, "auto">, q: string): UpstreamQuery[] {
  switch (field) {
    case "name":
      return [{ field, param: "name", value: q }];
    case "email": {
      if (!q.includes("+")) return [{ field, param: "email", value: q }];
      const [before, ...rest] = q.split("+");
      const value = before || rest.join("+").replace(/\+/g, "");
      const full = q.toLowerCase();
      return [{ field, param: "email", value, keep: (s) => !!s.email?.toLowerCase().includes(full) }];
    }
    case "customerId": {
      const lower = q.toLowerCase();
      return lower === q
        ? [{ field, param: "uuid", value: q }]
        : [{ field, param: "uuid", value: q }, { field, param: "uuid", value: lower }];
    }
    case "mac": {
      const mac = normaliseMac(q);
      if (!mac) throw new SearchInputError("Enter at least 4 octets of the MAC, e.g. A4-FC-A1-2D.");
      return [{ field, param: "device_id", value: mac }];
    }
    case "serial":
      return [{ field, param: "serial_no", value: q.toUpperCase() }];
  }
}

/** Corteca queries for a search; Auto with no clear pattern fans out over name, email and customer ID. */
export function upstreamQueries(q: string, field: SearchField): UpstreamQuery[] {
  const t = q.trim();
  if (field !== "auto") return queriesFor(field, t);
  const detected = detectField(t);
  if (detected) return queriesFor(detected, t);
  return [...queriesFor("name", t), ...queriesFor("email", t), ...queriesFor("customerId", t)];
}

/** Stable key: customer ID, else the network (MAC/serial matches can have no subscriber). */
export function subscriberKey(s: Subscriber): string {
  return s.uuid || s.customer_id || s.home_wifis?.[0]?.id || "";
}

export function hasSubscriber(s: Subscriber): boolean {
  return !!(s.uuid || s.customer_id || s.name || s.email);
}

export function subscriberName(s: Subscriber): string {
  return s.name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email || s.customer_id || s.uuid
    || (s.home_wifis?.[0]?.id ? "Unassigned network" : "Subscriber");
}

/** Merge result lists from several queries, first occurrence wins. */
export function mergeSubscribers(lists: Subscriber[][]): Subscriber[] {
  const seen = new Set<string>();
  const out: Subscriber[] = [];
  for (const s of lists.flat()) {
    const k = subscriberKey(s) || JSON.stringify(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
