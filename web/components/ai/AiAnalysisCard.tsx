"use client";

import { useEffect, useState } from "react";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { Notice } from "@/web/components/corteca/Notice";
import { OutlineButton } from "@/web/components/corteca/OutlineButton";
import { StatusPill, type PillTone } from "@/web/components/corteca/StatusPill";
import type { AnalysisReport, Diagnosis } from "@/web/lib/aiAnalysis";
import type { AiRun } from "@/web/lib/useAiAnalysis";
import { MarkdownReport } from "./MarkdownReport";
import { DiagnosisView } from "./DiagnosisView";
import { TroubleshootForm } from "./TroubleshootForm";

/** Corteca's own overall state word → pill tone. */
function stateTone(state: string): PillTone {
  const s = state.toLowerCase();
  if (s.startsWith("healthy")) return "good";
  if (/impacted|degraded|warning|attention|maintenance/.test(s)) return "fair";
  if (/critical|down|offline|outage|unhealthy/.test(s)) return "poor";
  return "neutral";
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return <span className="tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}

function Running({ what, since }: { what: string; since: number }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      {what}… <Elapsed since={since} /> <span className="text-xs text-blue-600/80">(usually 30 s – 2½ min)</span>
    </p>
  );
}

const ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);

/** On-demand Corteca AI: full network analysis and plain-language troubleshooting. */
export function AiAnalysisCard({ analysis, diagnosis, onAnalyze, onTroubleshoot }: {
  analysis: AiRun<AnalysisReport>;
  diagnosis: AiRun<Diagnosis> & { query: string };
  onAnalyze: () => void;
  onTroubleshoot: (query: string) => void;
}) {
  const report = analysis.result;
  return (
    <CortecaCard
      id="ai-analysis"
      title="AI analysis"
      info="Runs Corteca's AI network analyzer and troubleshooter through MCP. Read-only: nothing on the network changes. Results are AI-generated; verify before acting."
      actions={
        <>
          {report?.state && <StatusPill tone={stateTone(report.state)}>{report.state}</StatusPill>}
          <OutlineButton icon={ICON} onClick={onAnalyze} disabled={analysis.running}>
            {report ? "Run again" : "Run analysis"}
          </OutlineButton>
        </>
      }
    >
      <div className="space-y-4">
        {analysis.running && analysis.startedAt && <Running what="Analyzing the network" since={analysis.startedAt} />}
        {analysis.error && <Notice tone="error" title="Analysis failed">{analysis.error}</Notice>}
        {report ? (
          <div>
            <p className="text-xs text-neutral-500">
              Ran {new Date(report.ranAt).toLocaleTimeString()} · took {Math.round(report.durationMs / 1000)} s.
              Beacons with findings are marked on the diagram; open a device for its notes.
            </p>
            <MarkdownReport markdown={report.markdown} />
          </div>
        ) : !analysis.running && (
          <p className="text-sm text-neutral-600">
            Checks internet connectivity, Beacon health, backhaul, firmware, client coverage and interference, with the last day, week and month of history.
          </p>
        )}

        <div className="space-y-3 border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Troubleshoot a problem</h3>
          <TroubleshootForm disabled={diagnosis.running} onSubmit={onTroubleshoot} />
          {diagnosis.running && diagnosis.startedAt && <Running what="Troubleshooting" since={diagnosis.startedAt} />}
          {diagnosis.error && <Notice tone="error" title="Troubleshooting failed">{diagnosis.error}</Notice>}
          {diagnosis.result && <DiagnosisView diagnosis={diagnosis.result} query={diagnosis.query} />}
        </div>
      </div>
    </CortecaCard>
  );
}
