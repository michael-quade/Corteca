import type { NetworkTab, TabStatus } from "@/web/lib/networkTabs";

export interface NetworkTabsProps {
  tabs: NetworkTab[];
  activeId: string | null;
  status: Record<string, TabStatus>;
  /** Tabs whose load, refresh or AI run finished while they were in the background. */
  unseen: Set<string>;
  onActivate: (networkId: string) => void;
  onClose: (networkId: string) => void;
}
