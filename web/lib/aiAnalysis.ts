// Reads the Markdown report from the MCP analyze-network tool and the JSON from
// troubleshoot-network. The report is AI-written and its wording varies, so
// parsing is deliberately loose: lines are attached to the devices whose MAC
// they mention, and only lines with clear issue words become diagram badges.
// Anything unrecognised is still shown in the full report.

import type { McpNetwork } from "@/web/lib/mcpNetwork";

export interface AnalysisReport {
  markdown: string;
  /** The "State:" line of "## Overall State" ("Healthy", "Recently impacted", …). */
  state: string | null;
  basis: string | null;
  /** Report lines that mention at least one MAC (normalised AABBCCDDEEFF). */
  lines: { text: string; macs: string[] }[];
  ranAt: string;
  durationMs: number;
}

const MAC_RE = /\b[0-9a-f]{2}([:-])[0-9a-f]{2}(?:\1[0-9a-f]{2}){4}\b/gi;
const norm = (mac: string) => mac.toUpperCase().replace(/[:-]/g, "");

/** Issue words; a zero count ("0 disconnects") never matches. */
const ISSUE_RE = /upgrade available|pending upgrade|needs? upgrade|needsUpgrade true|degrad|unstable|\bpoor\b|\bweak\b|\boffline now\b|\b[1-9]\d* (?:reboots?|disconnects?|disconnections?|power ?cycles?|wan ?failures?)\b/i;

const stripMd = (line: string) => line.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, "").trim();

export function parseAnalysisReport(markdown: string, durationMs: number): AnalysisReport {
  const raw = markdown.split(/\r?\n/).map(stripMd);
  const state = raw.map((l) => l.match(/^State:\s*(.+)$/i)?.[1]).find(Boolean) ?? null;
  const basis = raw.map((l) => l.match(/^Basis:\s*(.+)$/i)?.[1]).find(Boolean) ?? null;
  const lines = raw
    .filter((text) => text && !text.startsWith("#"))
    .map((text) => ({ text, macs: [...new Set((text.match(MAC_RE) ?? []).map(norm))] }))
    .filter((l) => l.macs.length);
  return { markdown, state, basis, lines, ranAt: new Date().toISOString(), durationMs };
}

export const isIssue = (line: string) => ISSUE_RE.test(line);

export interface AiNotes { issues: string[]; other: string[] }

/**
 * Which devices each line is about. A client line also names the AP it is on
 * ("… on extender 0C:7C:…", "… AP 0C:7C:…"; the wording varies by run), so when a
 * line mentions any non-AP device, its AP MACs are context and only the clients get it.
 */
function notesByDevice(report: AnalysisReport, apMacs: Set<string>): Map<string, AiNotes> {
  const out = new Map<string, AiNotes>();
  for (const { text, macs } of report.lines) {
    const clients = macs.filter((m) => !apMacs.has(m));
    for (const mac of clients.length ? clients : macs) {
      const n = out.get(mac) ?? { issues: [], other: [] };
      const bucket = isIssue(text) ? n.issues : n.other;
      if (!bucket.includes(text)) bucket.push(text);
      out.set(mac, n);
    }
  }
  return out;
}

/**
 * Puts each device's report lines on the network: APs get `ai` (their issue lines
 * badge the diagram card), clients get `aiNotes` for their panel. Clients aren't
 * badged: most have a disconnect or two in a week, which would flag nearly all.
 */
export function applyAiReport(network: McpNetwork, report: AnalysisReport | null): McpNetwork {
  if (!report) return network;
  const notes = notesByDevice(report, new Set(network.aps.map((a) => norm(a.mac))));
  const aps = network.aps.map((ap) => {
    const ai = notes.get(norm(ap.mac));
    return ai ? { ...ap, ai } : ap;
  });
  const members = network.members.map((m) => {
    const aiNotes = notes.get(norm(m.id));
    return aiNotes ? ({ ...m, aiNotes } as typeof m) : m;
  });
  return { ...network, aps, members, topology: { ...network.topology, members } };
}

export const memberAiNotes = (m: object): AiNotes | undefined => (m as { aiNotes?: AiNotes }).aiNotes;

// ── Troubleshooting ──────────────────────────────────────────────────────────

export interface Diagnosis {
  summary: string;
  problems: { title: string; evidence: string }[];
  rootCauses: { description: string; confidence: string }[];
  recommendedActions: { kind: string; what: string; reason: string }[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : []);

/** Validates a troubleshoot-network diagnosis; falls back to the text summary alone. */
export function parseDiagnosis(raw: unknown, summary: string | null): Diagnosis | null {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Diagnosis = {
    summary: str(d.summary) || str(summary),
    problems: list(d.problems).map((p) => ({ title: str(p.title), evidence: str(p.evidence) })).filter((p) => p.title || p.evidence),
    rootCauses: list(d.rootCauses).map((c) => ({ description: str(c.description), confidence: str(c.confidence) })).filter((c) => c.description),
    recommendedActions: list(d.recommendedActions).map((a) => ({ kind: str(a.kind), what: str(a.what), reason: str(a.reason) })).filter((a) => a.what),
  };
  return out.summary || out.problems.length || out.rootCauses.length || out.recommendedActions.length ? out : null;
}
