"use client";

import { cn } from "@/web/lib/utils";
import { Hint } from "@/web/components/ui/Hint";
import { subscriberName } from "@/web/lib/subscriberSearch";
import { MAX_NETWORK_TABS, type NetworkTab, type TabStatus } from "@/web/lib/networkTabs";
import type { NetworkTabsProps } from "./NetworkTabs.types";

/** A tab's name: the subscriber, or the network's root MAC when opened from a shared link. */
export function tabLabel(tab: Pick<NetworkTab, "networkId" | "subscriber">): string {
  return tab.subscriber ? subscriberName(tab.subscriber) : tab.networkId;
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
}

function activity(s: TabStatus | undefined, unseen: boolean): string | null {
  if (!s || (!s.loaded && !s.loading && !s.error)) return "Not loaded yet — loads when opened";
  if (s.loading) return "Loading from MCP…";
  if (s.refreshing) return "Refreshing…";
  if (s.aiRunning) return "AI analysis running";
  if (s.error) return s.loaded ? "Last refresh failed" : "Couldn't load";
  return unseen ? "Updated while you were on another tab" : null;
}

function hint(tab: NetworkTab, s: TabStatus | undefined, unseen: boolean): string {
  const id = tab.subscriber?.customer_id ?? tab.subscriber?.uuid;
  return [
    tabLabel(tab),
    id && `Customer ID ${id}`,
    tab.subscriber && `Network ${tab.networkId}`,
    s?.capturedAt && `Data ${ago(s.capturedAt)}`,
    activity(s, unseen),
  ].filter(Boolean).join("\n");
}

const SPARKLE = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
  </svg>
);

/** One tab per open network: name, gateway model, activity marks and a close button. */
export function NetworkTabs({ tabs, activeId, status, unseen, onActivate, onClose }: NetworkTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Open networks">
      {tabs.map((tab) => {
        const s = status[tab.networkId];
        const active = tab.networkId === activeId;
        const fresh = unseen.has(tab.networkId);
        const online = tab.subscriber?.home_wifis?.[0]?.status?.online;
        const label = tabLabel(tab);
        const model = s?.gatewayModel ?? tab.gatewayModel;
        return (
          <Hint key={tab.networkId} text={hint(tab, s, fresh)}>
            {(hintId) => (
              <div
                className={cn(
                  "flex max-w-[18rem] items-center rounded-lg border bg-white text-sm transition-colors",
                  active ? "border-blue-600 ring-1 ring-blue-600" : "border-neutral-200 hover:border-neutral-400"
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-describedby={hintId}
                  onClick={() => onActivate(tab.networkId)}
                  className="flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-1"
                >
                  {tab.subscriber && <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} />}
                  <span className={cn("truncate font-medium", active ? "text-blue-700" : "text-neutral-800", !tab.subscriber && "font-mono text-xs")}>
                    {label}
                  </span>
                  {model && (
                    <span className="flex-shrink-0 rounded bg-blue-50 px-1.5 py-px text-[11px] font-medium text-blue-700">{model}</span>
                  )}
                  {(s?.loading || s?.refreshing) && (
                    <span className="h-3 w-3 flex-shrink-0 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" aria-label="Loading" />
                  )}
                  {s?.aiRunning && <span className="flex-shrink-0 animate-pulse text-blue-600" aria-label="AI analysis running">{SPARKLE}</span>}
                  {s?.error && !s.loading && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" aria-label="Error" />}
                  {fresh && !s?.error && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" aria-label="Updated" />}
                </button>
                <button
                  type="button"
                  onClick={() => onClose(tab.networkId)}
                  aria-label={`Close ${label}`}
                  className="mr-1 flex-shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}
          </Hint>
        );
      })}
      <span className="ml-1 flex-shrink-0 whitespace-nowrap text-xs text-neutral-500">
        {tabs.length} of {MAX_NETWORK_TABS} open
      </span>
    </div>
  );
}
