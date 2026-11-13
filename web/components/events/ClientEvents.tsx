"use client";

import { useMemo } from "react";
import type { Member } from "@/web/lib/corteca/types";
import { normaliseMac } from "@/web/lib/networkEvents";
import { useEvents } from "./EventsContext";
import { EventRow } from "./EventRow";

/** Client panel "Device events" (last section): joins, renames, type changes from the activity log. */
export function ClientEvents({ member }: { member: Member }) {
  const ev = useEvents();
  const mac = normaliseMac(member.id);
  const mine = useMemo(() => (ev?.items ?? []).filter((it) => it.device === mac && it.kind !== "routine"), [ev?.items, mac]);
  if (!ev) return null;

  return (
    <section className="border-t border-neutral-100 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Device events</h4>
        <span className="text-[11px] text-neutral-500">last 30 days</span>
      </div>
      {(ev.load === "loading" || ev.load === "idle") && <p className="text-xs text-neutral-500">Reading Corteca&apos;s activity log…</p>}
      {ev.load === "error" && <p className="text-xs text-neutral-500">Couldn&apos;t read the activity log.</p>}
      {ev.load === "ready" && (mine.length === 0
        ? <p className="text-xs text-neutral-500">No joins, renames or type changes in the last 30 days.</p>
        : <ol className="-mx-2 space-y-0.5">{mine.map((it) => <EventRow key={it.key} item={it} own />)}</ol>)}
      <p className="mt-2 text-[10px] text-neutral-400">
        From Corteca&apos;s activity log. Connects, disconnects and roams are in the connection history above.
      </p>
    </section>
  );
}
