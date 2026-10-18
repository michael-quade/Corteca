"use client";

import type { Diagnosis } from "@/web/lib/aiAnalysis";
import { StatusPill } from "@/web/components/corteca/StatusPill";

const CONFIDENCE_TONE: Record<string, "info" | "neutral"> = { high: "info", medium: "neutral", low: "neutral" };

const kindLabel = (kind: string) => kind.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** troubleshoot-network result: summary, problems with evidence, likely causes, next actions. */
export function DiagnosisView({ diagnosis, query }: { diagnosis: Diagnosis; query: string }) {
  const { summary, problems, rootCauses, recommendedActions } = diagnosis;
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-neutral-700">
      <div>
        <p className="text-xs text-neutral-500">“{query}”</p>
        {summary && <p className="mt-1 text-sm text-neutral-900">{summary}</p>}
      </div>

      {problems.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-neutral-900">Detected problems</h4>
          <ul className="space-y-2">
            {problems.map((p, i) => (
              <li key={i} className="rounded-lg bg-neutral-50 px-3 py-2">
                <p className="font-medium text-neutral-900">{p.title}</p>
                {p.evidence && <p className="text-neutral-600">{p.evidence}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rootCauses.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-neutral-900">Likely root causes</h4>
          <ul className="space-y-1.5">
            {rootCauses.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                {c.confidence && <StatusPill tone={CONFIDENCE_TONE[c.confidence.toLowerCase()] ?? "neutral"}>{c.confidence}</StatusPill>}
                <span>{c.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendedActions.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-neutral-900">Recommended next actions</h4>
          <ol className="list-decimal space-y-1.5 pl-5">
            {recommendedActions.map((a, i) => (
              <li key={i}>
                <span className="font-medium text-neutral-900">{a.what}</span>
                {a.kind && <span className="ml-1 text-xs text-neutral-400">({kindLabel(a.kind)})</span>}
                {a.reason && <p className="text-neutral-600">{a.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-[11px] text-neutral-400">AI-generated diagnosis from Corteca. It never changes the network; verify before acting.</p>
    </div>
  );
}
