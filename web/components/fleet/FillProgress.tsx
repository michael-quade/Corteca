"use client";

import { Notice } from "@/web/components/corteca/Notice";
import type { FillState, Filling } from "@/web/lib/fleet/useFleetFill";

/**
 * Status of a filling read: spinner before the first answer, then "Read 312 of 720 hours" while
 * Corteca is still being read, and a note when some buckets couldn't be read.
 */
export function FillProgress<T extends Filling>({ state, unit, what }: { state: FillState<T>; unit: string; what: string }) {
  if (state.error && !state.data) return <Notice tone="error" title={`Couldn't load ${what}`}>{state.error}</Notice>;
  if (!state.data) {
    return (
      <div className="flex items-center gap-3 py-10 text-sm text-neutral-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
        Reading {what} from Corteca…
      </div>
    );
  }
  const d = state.data;
  if (state.progress) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Read {state.progress.done.toLocaleString()} of {state.progress.total.toLocaleString()} {unit} — the charts fill in as more arrive. Later visits are instant.
      </div>
    );
  }
  if (d.pending > 0 || d.errors.length) {
    return (
      <Notice title={`${d.pending.toLocaleString()} ${unit} couldn't be read yet`}>
        {d.errors.join(" · ") || "Corteca was slow to answer."} Refresh to try again; the daily update also fills them in.
      </Notice>
    );
  }
  return null;
}
