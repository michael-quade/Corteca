import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/web/components/ui/Button";
import { cn } from "@/web/lib/utils";
import { tabLabel } from "@/web/components/mcp/NetworkTabs";
import { MAX_NETWORK_TABS, type NetworkTab, type TabStatus } from "@/web/lib/networkTabs";
import type { TabLimitModalProps } from "./TabLimitModal.types";

function busyNote(s: TabStatus | undefined): string | null {
  if (s?.aiRunning) return "AI analysis running — closing discards it";
  if (s?.loading || s?.refreshing) return "Loading";
  return null;
}

/** All network tabs are in use: close one to open the network that is waiting. */
export function TabLimitModal({ pendingLabel, tabs, status, onCloseAndOpen, onCancel }: TabLimitModalProps) {
  return (
    <Dialog.Root open={pendingLabel !== null} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold text-neutral-900">
            {MAX_NETWORK_TABS} networks are open
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-neutral-600">
            Close one to open <span className="font-semibold text-neutral-900">{pendingLabel}</span>.
          </Dialog.Description>

          <ul className="mt-4 divide-y divide-neutral-100 rounded-xl ring-1 ring-neutral-200">
            {tabs.map((tab: NetworkTab) => {
              const s = status[tab.networkId];
              const note = busyNote(s);
              const model = s?.gatewayModel ?? tab.gatewayModel;
              const detail = [tab.subscriber ? tab.networkId : null, model].filter(Boolean).join(" · ");
              return (
                <li key={tab.networkId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className={cn("block truncate text-sm font-medium text-neutral-900", !tab.subscriber && "font-mono")}>{tabLabel(tab)}</span>
                    {(detail || note) && (
                      <span className="block text-[11px] text-neutral-500">
                        {detail}
                        {note && <span className="text-amber-700">{detail && " · "}{note}</span>}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCloseAndOpen(tab.networkId)}
                    className="flex-shrink-0 rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Close &amp; open
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
