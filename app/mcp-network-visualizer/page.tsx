"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { McpTopBar } from "@/web/components/McpTopBar";
import { RecentNetworksDrawer } from "@/web/components/RecentNetworksDrawer";
import { NetworkWorkspace } from "@/web/components/mcp/NetworkWorkspace";
import { NetworkTabs, tabLabel } from "@/web/components/mcp/NetworkTabs";
import { TabLimitModal } from "@/web/components/modals/TabLimitModal";
import { ConfirmModal } from "@/web/components/modals/ConfirmModal";
import { subscriberName } from "@/web/lib/subscriberSearch";
import { clearRecentNetworks, forgetNetwork, loadRecentNetworks, type RecentNetwork } from "@/web/lib/recentNetworks";
import { useNetworkTabs } from "@/web/lib/useNetworkTabs";
import type { WorkspaceActions } from "@/web/lib/networkTabs";
import type { Subscriber } from "@/web/lib/corteca/types";

/**
 * MCP visualizer: up to MAX_NETWORK_TABS networks open side by side, one tab each.
 * Every open network keeps its data, view, Refresh and AI runs (see NetworkWorkspace);
 * the top bar acts on the tab on screen.
 */
export default function McpNetworkVisualizerPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const tabs = useNetworkTabs(isAuthenticated);
  const actions = useRef<Record<string, WorkspaceActions>>({});
  const [recent, setRecent] = useState<RecentNetwork[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Closing a tab with an AI run in progress asks first.
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  useEffect(() => { setRecent(loadRecentNetworks()); }, []);

  // No tabs left: the URL no longer names a network.
  useEffect(() => {
    if (tabs.ready && tabs.tabs.length === 0 && window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [tabs.ready, tabs.tabs.length]);

  function handleSubscriberSelect(subscriber: Subscriber) {
    const networkId = subscriber.home_wifis?.[0]?.id;
    if (!networkId) { setSearchError(`No network ID found for ${subscriberName(subscriber)}.`); return; }
    setSearchError(null);
    tabs.open(networkId, subscriber);
  }

  function requestClose(id: string) {
    if (tabs.status[id]?.aiRunning) setConfirmClose(id);
    else tabs.close(id);
  }

  const onRecentChange = useCallback((list: RecentNetwork[]) => setRecent(list), []);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
      </main>
    );
  }

  const activeTab = tabs.tabs.find((t) => t.networkId === tabs.activeId) ?? null;
  const activeStatus = activeTab ? tabs.status[activeTab.networkId] : undefined;
  const canAct = !!activeStatus?.loaded && !activeStatus.loading;
  const closing = tabs.tabs.find((t) => t.networkId === confirmClose);

  return (
    <main className="mx-auto max-w-[2304px] px-4 py-3">
      <div className="flex gap-3">
        <RecentNetworksDrawer
          entries={recent}
          currentId={tabs.activeId}
          openIds={tabs.tabs.map((t) => t.networkId)}
          onPick={(r) => tabs.open(r.networkId, r.subscriber)}
          onRemove={(id) => setRecent(forgetNetwork(id))}
          onClear={() => setRecent(clearRecentNetworks())}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <McpTopBar
            subscriber={activeTab?.subscriber ?? null}
            networkId={activeTab?.networkId ?? null}
            capturedAt={activeStatus?.capturedAt ?? null}
            onSelectSubscriber={handleSubscriberSelect}
            onRefresh={canAct ? () => activeTab && actions.current[activeTab.networkId]?.refresh() : undefined}
            refreshing={activeStatus?.refreshing}
            onAiAnalysis={canAct ? () => activeTab && actions.current[activeTab.networkId]?.aiAnalysis() : undefined}
            aiRunning={activeStatus?.aiRunning}
          />

          {tabs.tabs.length > 0 && (
            <NetworkTabs
              tabs={tabs.tabs}
              activeId={tabs.activeId}
              status={tabs.status}
              unseen={tabs.unseen}
              onActivate={tabs.activate}
              onClose={requestClose}
            />
          )}

          {searchError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{searchError}</div>
          )}

          {tabs.ready && tabs.tabs.length === 0 && (
            <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/70 text-center">
              <p className="text-sm font-medium text-neutral-700">Search for a subscriber above to load their home network.</p>
              <p className="text-xs text-neutral-500">
                Or reopen one from <span className="font-semibold">Recent</span> on the left. Each network opens in its own tab — up to 5 at once.
                Data comes live from the Corteca AI MCP server.
              </p>
            </div>
          )}

          {tabs.tabs.map((tab) => (
            <NetworkWorkspace
              key={tab.networkId}
              networkId={tab.networkId}
              subscriber={tab.subscriber}
              initialView={tab.initialView}
              active={tab.networkId === tabs.activeId}
              onStatus={tabs.report}
              onRecentChange={onRecentChange}
              actions={actions}
            />
          ))}
        </div>
      </div>

      <TabLimitModal
        pendingLabel={tabs.pending ? tabLabel(tabs.pending) : null}
        tabs={tabs.tabs}
        status={tabs.status}
        onCloseAndOpen={tabs.closeAndOpenPending}
        onCancel={tabs.cancelPending}
      />
      <ConfirmModal
        isOpen={!!closing}
        onClose={() => setConfirmClose(null)}
        onConfirm={() => { if (closing) tabs.close(closing.networkId); }}
        title="Close this network?"
        description={closing ? `Corteca's AI is still working on ${tabLabel(closing)}. Closing the tab discards its result.` : ""}
        confirmLabel="Close tab"
        cancelLabel="Keep open"
      />
    </main>
  );
}
