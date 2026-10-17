"use client";

import { cn } from "@/web/lib/utils";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { OutlineButton } from "@/web/components/corteca/OutlineButton";
import { SEVERITIES, SEVERITY_TOGGLE } from "./severity";
import type { AlarmQueryFormProps } from "./AlarmQueryForm.types";

const INPUT = "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const LABEL = "flex items-center gap-1 text-xs font-medium text-neutral-700";

/** Query parameters for the ouife alarms endpoint, plus the reboot cross-reference action. */
export function AlarmQueryForm(p: AlarmQueryFormProps) {
  return (
    <CortecaCard title="Query parameters">
      <form
        onSubmit={(e) => { e.preventDefault(); if (p.canFetch && !p.loading) p.onFetch(); }}
        className="flex flex-wrap gap-5"
      >
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <label className={LABEL}>
            Start date/time <span className="text-red-500">*</span>
            <span className="font-normal text-neutral-400">(UTC)</span>
          </label>
          <input type="datetime-local" value={p.dateStart} onChange={(e) => p.onDateStart(e.target.value)} className={INPUT} />
        </div>

        <div className="flex min-w-[200px] flex-col gap-1.5">
          <label className={LABEL}>
            End date/time <span className="text-red-500">*</span>
            <span className="font-normal text-neutral-400">(UTC)</span>
          </label>
          <input type="datetime-local" value={p.dateEnd} onChange={(e) => p.onDateEnd(e.target.value)} className={INPUT} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Severity <span className="text-red-500">*</span></span>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={p.severities.has(s)}
                data-checked={p.severities.has(s) ? "" : undefined}
                onClick={() => p.onToggleSeverity(s)}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors", SEVERITY_TOGGLE[s])}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col gap-1.5">
          <label className={LABEL}>Device MAC <span className="font-normal text-neutral-400">(optional filter)</span></label>
          <input
            type="text"
            placeholder="AA-BB-CC-DD-EE-FF"
            value={p.deviceMac}
            onChange={(e) => p.onDeviceMac(e.target.value)}
            className={cn(INPUT, "font-mono placeholder:font-sans placeholder:text-neutral-400")}
          />
        </div>

        <div className="flex flex-col justify-end gap-1.5">
          <span className={LABEL}>Alarm type</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 hover:border-blue-300">
            <input
              type="checkbox"
              checked={p.customAlarms}
              onChange={(e) => p.onCustomAlarms(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
            />
            <span className="text-sm text-neutral-700">Custom alarms only</span>
          </label>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 pt-1">
          {!p.canFetch && (
            <p className="w-full text-xs text-yellow-700">Start date, end date, and at least one severity are required.</p>
          )}
          <button
            type="submit"
            disabled={!p.canFetch || p.loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {p.loading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Fetching…</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5" /><path d="m13 13-3-3" /></svg>
                Fetch Alarms
              </>
            )}
          </button>
          <OutlineButton
            onClick={p.onCrossRef}
            disabled={!p.hasResults || p.loading || p.crossRefLoading}
            title={!p.hasResults ? "Fetch alarms first" : "Cross-reference alarm AP MACs against the latest reboot report"}
            icon={p.crossRefLoading
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h12M2 8h8M2 4h5" /><circle cx="13" cy="6" r="2.5" /><path d="m15 8.5-1.5-1.5" /></svg>}
          >
            {p.crossRefLoading ? "Fetching Reboot Report…" : "Cross Reference Reboot Report"}
          </OutlineButton>
          {p.crossRefActive && (
            <button type="button" onClick={p.onClearCrossRef} className="text-xs font-medium text-blue-600 hover:underline">
              Clear cross-reference
            </button>
          )}
        </div>
      </form>
    </CortecaCard>
  );
}
