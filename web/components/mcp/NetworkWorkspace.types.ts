import type { MutableRefObject } from "react";
import type { Subscriber } from "@/web/lib/corteca/types";
import type { RecentNetwork } from "@/web/lib/recentNetworks";
import type { TabStatus, WorkspaceActions } from "@/web/lib/networkTabs";
import type { ViewState } from "@/web/lib/topologySelection";

export interface NetworkWorkspaceProps {
  networkId: string;
  subscriber: Subscriber | null;
  initialView: ViewState;
  /** On screen. Hidden workspaces stay mounted, so their data, view and running AI calls survive. */
  active: boolean;
  onStatus: (networkId: string, status: TabStatus) => void;
  onRecentChange: (recent: RecentNetwork[]) => void;
  /** Top-bar actions per network; the workspace registers its own. */
  actions: MutableRefObject<Record<string, WorkspaceActions>>;
}
