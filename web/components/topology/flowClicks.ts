import type { Edge, Node } from "@xyflow/react";
import type { Selection, SelectionKind } from "@/web/lib/topologySelection";

/** Diagram clicks → selection; clicking what is already selected clears it. */
export function flowClickHandlers(selection: Selection | null, onSelect: (s: Selection | null) => void) {
  const toggle = (kind: SelectionKind, id: string) =>
    onSelect(selection?.kind === kind && selection.id === id ? null : { kind, id });
  return {
    onNodeClick: (_: unknown, node: Node) => {
      // Wired client pills are `wc:<MAC>`.
      if (node.type === "wired") toggle("client", node.id.slice(3));
      else if (node.type === "ap" || node.type === "switch") toggle(node.type, node.id);
    },
    onEdgeClick: (_: unknown, edge: Edge) => {
      if (edge.type === "wiredLink") toggle("client", edge.target.slice(3));
      else if (edge.type === "switchUplink") toggle("switch", edge.target);
      // Backhaul links are selected by their child AP.
      else if (edge.type === "backhaul") toggle("link", edge.target);
    },
  };
}
