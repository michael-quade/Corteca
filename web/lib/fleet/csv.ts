/**
 * CSV parser for Corteca's fleet CSVs (device status, cluster events, steering…).
 * Handles quoted fields, "" escapes and line breaks inside quotes — the ouife CSVs put
 * multi-line messages in a field, which a line-by-line split breaks.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((f) => f !== "")) records.push(record);
      record = [];
    } else field += c;
  }
  record.push(field);
  if (record.some((f) => f !== "")) records.push(record);

  const [head, ...body] = records;
  if (!head) return { headers: [], rows: [] };
  const headers = head.map((h) => h.trim());
  const rows = body.map((vals) => Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()])));
  return { headers, rows };
}
