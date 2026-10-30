// Networks open side by side in the MCP visualizer, one tab each.
// The list survives a page reload (sessionStorage: this browser tab only).

import type { Subscriber } from "@/web/lib/corteca/types";
import { EMPTY_FILTERS, type ViewState } from "@/web/lib/topologySelection";
import type { LayoutMode } from "@/web/lib/topologyFlow";

export const MAX_NETWORK_TABS = 5;

export interface NetworkTab {
  networkId: string;
  subscriber: Subscriber | null;
  /** From Recent, so a tab not loaded yet still shows its model. */
  gatewayModel?: string;
  /** View the tab opens with (from the URL for a shared link, otherwise clean). */
  initialView: ViewState;
}

/** What a tab's workspace reports up, for the tab strip and the top bar. */
export interface TabStatus {
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  aiRunning: boolean;
  error: boolean;
  capturedAt: string | null;
  gatewayModel?: string;
  layout: LayoutMode;
}

/** Top-bar actions on the active tab, registered by its workspace. */
export interface WorkspaceActions {
  refresh: () => void;
  aiAnalysis: () => void;
}

export const isBusy = (s: TabStatus | undefined) => !!s && (s.loading || s.refreshing || s.aiRunning);

export function freshView(networkId: string, layout: LayoutMode = "tree"): ViewState {
  return { network: networkId, selection: null, filters: EMPTY_FILTERS, layout, viewport: null };
}

interface StoredTabs {
  tabs: { networkId: string; subscriber: Subscriber | null }[];
  activeId: string | null;
}

const KEY = "mcp-visualizer:open-tabs";

export function loadOpenTabs(): StoredTabs {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredTabs) : null;
    const tabs = Array.isArray(parsed?.tabs) ? parsed.tabs.filter((t) => t && typeof t.networkId === "string").slice(0, MAX_NETWORK_TABS) : [];
    const activeId = tabs.some((t) => t.networkId === parsed?.activeId) ? parsed!.activeId : tabs[0]?.networkId ?? null;
    return { tabs, activeId };
  } catch {
    return { tabs: [], activeId: null };
  }
}

export function saveOpenTabs(tabs: NetworkTab[], activeId: string | null) {
  const stored: StoredTabs = { tabs: tabs.map(({ networkId, subscriber }) => ({ networkId, subscriber })), activeId };
  try { sessionStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* storage unavailable */ }
}
