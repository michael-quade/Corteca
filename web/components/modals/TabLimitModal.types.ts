import type { NetworkTab, TabStatus } from "@/web/lib/networkTabs";

export interface TabLimitModalProps {
  /** Name of the network waiting to open; null = closed. */
  pendingLabel: string | null;
  tabs: NetworkTab[];
  status: Record<string, TabStatus>;
  onCloseAndOpen: (networkId: string) => void;
  onCancel: () => void;
}
