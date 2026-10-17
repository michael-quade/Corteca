import type { Subscriber } from "@/web/lib/corteca/types";

export interface McpTopBarProps {
  subscriber: Subscriber | null;
  networkId: string | null;
  capturedAt: string | null;
  onSelectSubscriber: (s: Subscriber) => void;
  /** Re-read the current network, keeping the view. Hidden until a network has loaded. */
  onRefresh?: () => void;
  refreshing?: boolean;
}
