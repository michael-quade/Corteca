import type { Subscriber } from "@/web/lib/corteca/types";

export interface McpTopBarProps {
  subscriber: Subscriber | null;
  networkId: string | null;
  capturedAt: string | null;
  onSelectSubscriber: (s: Subscriber) => void;
  /** Re-read the current network, keeping the view. Hidden until a network has loaded. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Jump to the AI analysis card (running it if it hasn't run). Hidden until a network has loaded. */
  onAiAnalysis?: () => void;
  aiRunning?: boolean;
  /** Open the events drawer on the diagram. Hidden until a network has loaded. */
  onEvents?: () => void;
  /** Events in the last 24 h, shown as a red count on the button. */
  eventsToday?: number;
}
