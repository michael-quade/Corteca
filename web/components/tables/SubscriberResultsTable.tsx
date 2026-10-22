"use client";

import { cn } from "@/web/lib/utils";
import { TABLE_HEAD_ROW } from "@/web/components/corteca/styles";
import { hasSubscriber, subscriberKey, subscriberName } from "@/web/lib/subscriberSearch";
import type { Subscriber } from "@/web/lib/corteca/types";

const TH = "px-3 py-2 text-left text-xs font-semibold text-neutral-700";
const TD = "px-3 py-2.5 text-sm text-neutral-800";

/** Subscriber search results: one row per subscriber (or unassigned network), click to select. */
export function SubscriberResultsTable({ results, selectedKey, onSelect }: {
  results: Subscriber[];
  selectedKey?: string;
  onSelect: (s: Subscriber) => void;
}) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-neutral-200">
      <table className="w-full min-w-max">
        <thead className="sticky top-0 z-10">
          <tr className={TABLE_HEAD_ROW}>
            <th className={TH}>Name</th>
            <th className={TH}>Email</th>
            <th className={TH}>Associated MAC</th>
            <th className={TH}>Customer ID</th>
            <th className={TH}>Serial number</th>
            <th className={TH}>Model</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((s) => {
            const key = subscriberKey(s);
            const net = s.home_wifis?.[0];
            const more = (s.home_wifis?.length ?? 0) - 1;
            const selected = !!selectedKey && key === selectedKey;
            return (
              <tr
                key={key}
                onClick={() => net?.id && onSelect(s)}
                className={cn(
                  "border-t border-neutral-100",
                  net?.id ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                  selected ? "bg-blue-50" : "bg-white hover:bg-neutral-50"
                )}
              >
                <td className={cn(TD, "font-medium", !hasSubscriber(s) && "font-normal italic text-neutral-500")}>
                  <button type="button" disabled={!net?.id} className="text-left focus:outline-none focus-visible:underline" onClick={(e) => { e.stopPropagation(); if (net?.id) onSelect(s); }}>
                    {subscriberName(s)}
                  </button>
                </td>
                <td className={cn(TD, "text-blue-600")}>{s.email ?? "—"}</td>
                <td className={cn(TD, "font-mono text-xs")}>
                  {net?.id ?? "No network"}
                  {more > 0 && <span className="ml-1.5 font-sans text-neutral-500">+{more} more</span>}
                </td>
                <td className={cn(TD, "text-neutral-600")}>{s.uuid ?? s.customer_id ?? "—"}</td>
                <td className={cn(TD, "font-mono text-xs")}>{net?.sn ?? "—"}</td>
                <td className={cn(TD, "text-neutral-600")}>{net?.pc || "—"}</td>
                <td className={TD}>
                  {net && (
                    <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                      <span className={cn("h-2 w-2 rounded-full", net.status?.online ? "bg-green-500" : "bg-neutral-300")} />
                      {net.status?.online ? "Online" : "Offline"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
