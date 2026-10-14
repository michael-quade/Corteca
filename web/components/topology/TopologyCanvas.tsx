"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider, useReactFlow,
  type Edge, type EdgeTypes, type NodeTypes,
} from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { buildFlowGraph, layoutFlowGraph, type FlowNode } from "@/web/lib/topologyFlow";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { ApNode } from "./ApNode";
import { ClientClusterNode } from "./ClientClusterNode";
import { BackhaulEdge } from "./BackhaulEdge";
import { TopologyLegend } from "./TopologyLegend";

const nodeTypes: NodeTypes = { ap: ApNode, cluster: ClientClusterNode };
const edgeTypes: EdgeTypes = { backhaul: BackhaulEdge };

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {active
        ? <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
        : <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />}
    </svg>
  );
}

function Canvas({ network }: { network: McpNetwork }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<FlowNode[] | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const firstLayout = useRef(true);

  const toggleCluster = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const graph = useMemo(() => buildFlowGraph(network, expanded, toggleCluster), [network, expanded, toggleCluster]);

  useEffect(() => {
    let cancelled = false;
    layoutFlowGraph(graph.nodes, graph.edges).then((laidOut) => {
      if (cancelled) return;
      setNodes(laidOut);
      setEdges(graph.edges);
      if (firstLayout.current) {
        firstLayout.current = false;
        requestAnimationFrame(() => fitView({ padding: 0.15, duration: 0 }));
      }
    });
    return () => { cancelled = true; };
  }, [graph, fitView]);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === wrapperRef.current);
      requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300 }));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [fitView]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapperRef.current?.requestFullscreen();
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative overflow-hidden rounded-xl border border-neutral-200 bg-white",
        fullscreen ? "h-screen w-screen rounded-none" : "h-[calc(100vh-14rem)] min-h-[560px]",
        // Smooth re-layout when clusters expand or data refreshes.
        "[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-500 motion-reduce:[&_.react-flow__node]:transition-none",
        "[&_.cluster-edge_path]:!stroke-neutral-300"
      )}
    >
      {!nodes ? (
        <div className="flex h-full items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.15}
          maxZoom={2.5}
          fitView
          fitViewOptions={{ padding: 0.15 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-neutral-50" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            // MiniMap sets fill inline, so a Tailwind class can't override it.
            nodeColor={(n) => (n.type === "ap" ? "rgb(99 102 241)" : "rgb(212 212 212)")}
            className="!rounded-lg !border !border-neutral-200"
          />
          <Panel position="top-left">
            <TopologyLegend />
          </Panel>
          <Panel position="top-right">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              <FullscreenIcon active={fullscreen} />
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
          </Panel>
        </ReactFlow>
      )}
    </div>
  );
}

export function TopologyCanvas({ network }: { network: McpNetwork }) {
  return (
    <ReactFlowProvider>
      {/* Keyed by network so expansion state resets when a different network loads. */}
      <Canvas key={network.topology.rootDeviceId} network={network} />
    </ReactFlowProvider>
  );
}
