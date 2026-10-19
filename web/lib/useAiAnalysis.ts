"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { parseAnalysisReport, parseDiagnosis, type AnalysisReport, type Diagnosis } from "@/web/lib/aiAnalysis";

export interface AiRun<T> {
  result: T | null;
  running: boolean;
  /** When the current run started (for the elapsed timer). */
  startedAt: number | null;
  error: string | null;
}

const IDLE = { result: null, running: false, startedAt: null, error: null };

// The AI routes stream heartbeats then the JSON, with { error } on failure (status 200).
async function getJson(url: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  const dropped = () => {
    const s = Math.round((Date.now() - started) / 1000);
    return new Error(`The connection dropped after ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} before Corteca answered. A proxy or network timeout may have cut it off; try again.`);
  };
  let res: Response;
  try { res = await fetchWithAuth(url); } catch { throw dropped(); }
  // Errors before streaming starts (auth, bad input, platform timeouts) keep their HTTP status.
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(String(body?.error ?? `HTTP ${res.status}`));
  }
  let text: string;
  try { text = await res.text(); } catch { throw dropped(); }
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { throw dropped(); }
  if (body.error) throw new Error(String(body.error));
  return body;
}

/**
 * On-demand MCP analysis and troubleshooting for one network (each takes ~30 s to
 * 2.5 min). Results stay while the same network is open, including across Refresh,
 * and clear when another network opens.
 */
export function useAiAnalysis(networkId: string | null) {
  const [analysis, setAnalysis] = useState<AiRun<AnalysisReport>>(IDLE);
  const [diagnosis, setDiagnosis] = useState<AiRun<Diagnosis> & { query: string }>({ ...IDLE, query: "" });
  const current = useRef(networkId);

  useEffect(() => {
    current.current = networkId;
    setAnalysis(IDLE);
    setDiagnosis({ ...IDLE, query: "" });
  }, [networkId]);

  const analyze = useCallback(async () => {
    if (!networkId) return;
    const id = networkId;
    setAnalysis((a) => ({ ...a, running: true, startedAt: Date.now(), error: null }));
    try {
      const body = await getJson(`/api/mcp/analyze/${encodeURIComponent(id)}`);
      const report = typeof body.report === "string" ? body.report : "";
      if (!report.trim()) throw new Error("The analysis returned no report.");
      if (current.current === id) setAnalysis({ ...IDLE, result: parseAnalysisReport(report, Number(body.durationMs) || 0) });
    } catch (e) {
      if (current.current === id) setAnalysis((a) => ({ ...a, running: false, startedAt: null, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [networkId]);

  const troubleshoot = useCallback(async (query: string) => {
    const q = query.trim();
    if (!networkId || !q) return;
    const id = networkId;
    setDiagnosis((d) => ({ ...d, query: q, running: true, startedAt: Date.now(), error: null }));
    try {
      const body = await getJson(`/api/mcp/troubleshoot/${encodeURIComponent(id)}?query=${encodeURIComponent(q)}`);
      const result = parseDiagnosis(body.diagnosis, typeof body.summary === "string" ? body.summary : null);
      if (!result) throw new Error("The troubleshooter returned no diagnosis.");
      if (current.current === id) setDiagnosis({ ...IDLE, query: q, result });
    } catch (e) {
      if (current.current === id) setDiagnosis((d) => ({ ...d, running: false, startedAt: null, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [networkId]);

  return { analysis, diagnosis, analyze, troubleshoot };
}
