"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Background, BackgroundVariant, MiniMap, Panel, ReactFlow, ReactFlowProvider, useReactFlow,
  type Edge, type EdgeTypes, type NodeTypes,
} from "@xyflow/react";
import { cn } from "@/web/lib/utils";
import { buildFlowGraph, clientBand, layoutFlowGraph, type FlowNode, type LayoutMode } from "@/web/lib/topologyFlow";
import {
  anchorNodeId, clientMatches, filtersActive, highlightFor, navigationOrder,
  type ClientFilters, type Selection, type Viewport,
} from "@/web/lib/topologySelection";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { ApNode } from "./ApNode";
import { ClientClusterNode } from "./ClientClusterNode";
import { BackhaulEdge } from "./BackhaulEdge";
import { RouteEdge } from "./RouteEdge";
import { TopologyLegend } from "./TopologyLegend";
import { ZoomControls } from "./ZoomControls";
import { TopologyToolbar } from "./TopologyToolbar";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { TopologyUiContext, type TopologyUi } from "./TopologyContext";

const nodeTypes: NodeTypes = { ap: ApNode, cluster: ClientClusterNode };
const edgeTypes: EdgeTypes = { backhaul: BackhaulEdge, route: RouteEdge };
const PANEL_W = 336; // detail panel width + margin, kept clear when panning to a node

export interface TopologyCanvasProps {
  network: McpNetwork;
  selection: Selection | null;
  onSelect: (sel: Selection | null) => void;
  filters: ClientFilters;
  onFiltersChange: (f: ClientFilters) => void;
  layout: LayoutMode;
  onLayoutChange: (l: LayoutMode) => void;
  initialViewport: Viewport | null;
  onViewportChange: (v: Viewport) => void;
}

function Canvas(props: TopologyCanvasProps) {
  const { network, selection, onSelect, filters, onFiltersChange, layout, onLayoutChange, initialViewport, onViewportChange } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const { fitView, getViewport, setViewport, setCenter, getNode } = useReactFlow();
  // View from just before the detail panel first pushed the diagram aside;
  // restored when the panel closes. Dropped if the user moves the view meanwhile.
  const restoreView = useRef<Viewport | null>(null);
  // View when the latest pan/drag gesture began: React Flow reports a pane click
  // at the end of a drag, which must not close the detail panel.
  const gestureStart = useRef<Viewport | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<FlowNode[] | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const lastLayoutMode = useRef(layout);

  const toggleCluster = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // A client selected from outside the graph may sit in a collapsed "+N" section.
  useEffect(() => {
    if (selection?.kind !== "client") return;
    const m = network.members.find((x) => x.id === selection.id);
    if (!m?.device_id) return;
    const section = `${m.device_id}:${clientBand(m)}`;
    setExpanded((prev) => (prev.has(section) ? prev : new Set(prev).add(section)));
  }, [selection, network]);

  const graph = useMemo(
    () => buildFlowGraph(network, expanded, toggleCluster, layout),
    [network, expanded, toggleCluster, layout]
  );

  useEffect(() => {
    let cancelled = false;
    layoutFlowGraph(graph.nodes, graph.edges, layout).then((laidOut) => {
      if (cancelled) return;
      setNodes(laidOut.nodes);
      setEdges(laidOut.edges);
      // The first view comes from ReactFlow's fitView/defaultViewport props;
      // switching layout refits.
      if (lastLayoutMode.current !== layout) {
        restoreView.current = null;
        requestAnimationFrame(() => fitView({ padding: 0.15, duration: 400 }));
      }
      lastLayoutMode.current = layout;
    });
    return () => { cancelled = true; };
  }, [graph, layout, fitView]);

  const highlight = useMemo(() => highlightFor(network, selection), [network, selection]);

  const visibleClients = useMemo(() => {
    if (!filtersActive(filters)) return null;
    return new Set(network.members.filter((m) => m.connected && clientMatches(m, filters, network)).map((m) => m.id));
  }, [network, filters]);

  const ui: TopologyUi = useMemo(() => ({
    selection, highlight, filters, layout, select: onSelect,
    clientVisible: (id) => !visibleClients || visibleClients.has(id),
  }), [selection, highlight, filters, layout, onSelect, visibleClients]);

  const styledNodes = useMemo(
    () => nodes?.map((n) => ({ ...n, className: highlight && !highlight.nodes.has(n.id) ? "opacity-30" : undefined })) ?? null,
    [nodes, highlight]
  );
  const styledEdges = useMemo(
    () => edges.map((e) => (e.type === "backhaul" ? e : {
      ...e, className: cn("cluster-edge", highlight && !highlight.edges.has(e.id) && "opacity-25"),
    })),
    [edges, highlight]
  );

  // Pan to the selection only when it is off-screen (or under the detail panel).
  useEffect(() => {
    if (!selection || !nodes) return;
    const id = anchorNodeId(network, selection);
    const node = id ? getNode(id) : undefined;
    const box = flowRef.current?.getBoundingClientRect();
    if (!node || !box) return;
    const { x, y, zoom } = getViewport();
    const w = node.width ?? 0, h = node.height ?? 0;
    const left = node.position.x * zoom + x, top = node.position.y * zoom + y;
    const fits = left >= 0 && top >= 0 && left + w * zoom <= box.width - PANEL_W && top + h * zoom <= box.height;
    if (!fits) {
      restoreView.current ??= { x, y, zoom };
      const z = Math.max(zoom, 0.8);
      // Offset the centre left by half the panel so the node lands in the visible area.
      setCenter(node.position.x + w / 2 + PANEL_W / 2 / z, node.position.y + h / 2, { zoom: z, duration: 400 });
    }
  }, [selection, nodes, network, getNode, getViewport, setCenter]);

  // Panel closed → put the diagram back where it was before the panel moved it.
  useEffect(() => {
    if (selection || !restoreView.current) return;
    void setViewport(restoreView.current, { duration: 400 });
    restoreView.current = null;
  }, [selection, setViewport]);

  useEffect(() => {
    const onChange = () => {
      restoreView.current = null;
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

  // Arrow keys step through APs and their clients in tree order; Esc clears.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { onSelect(null); return; }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const order = navigationOrder(network);
    if (!order.length) return;
    const i = selection ? order.findIndex((s) => s.kind === selection.kind && s.id === selection.id) : -1;
    const next = i < 0 ? (step > 0 ? 0 : order.length - 1) : (i + step + order.length) % order.length;
    onSelect(order.at(next) ?? null);
  }

  return (
    <TopologyUiContext.Provider value={ui}>
      <div
        ref={wrapperRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Network topology. Arrow keys move between devices, Escape clears the selection."
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
          fullscreen ? "h-screen w-screen rounded-none" : "h-[calc(100vh-8.5rem)] min-h-[520px]"
        )}
      >
        <TopologyToolbar
          network={network}
          filters={filters}
          onFiltersChange={onFiltersChange}
          matchCount={visibleClients?.size ?? 0}
          layout={layout}
          onLayoutChange={onLayoutChange}
          onSelect={onSelect}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
        <div
          ref={flowRef}
          className={cn(
            "relative flex-1",
            // Smooth re-layout and dimming.
            "[&_.react-flow__node]:transition-[transform,opacity] [&_.react-flow__node]:duration-500 motion-reduce:[&_.react-flow__node]:transition-none",
            "[&_.cluster-edge]:transition-opacity [&_.cluster-edge_path]:!stroke-neutral-300"
          )}
        >
          {!styledNodes ? (
            <div className="flex h-full items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
            </div>
          ) : (
            <ReactFlow
              nodes={styledNodes}
              edges={styledEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              // Registering click handlers also keeps React Flow from turning off
              // pointer events on non-selectable nodes/edges (pills, "+N", labels).
              onNodeClick={(_, node) => {
                if (node.type !== "ap") return;
                onSelect(selection?.kind === "ap" && selection.id === node.id ? null : { kind: "ap", id: node.id });
              }}
              onEdgeClick={(_, edge) => {
                if (edge.type !== "backhaul") return;
                const child = edge.target;
                onSelect(selection?.kind === "link" && selection.id === child ? null : { kind: "link", id: child });
              }}
              onPaneClick={() => {
                const s0 = gestureStart.current, v = getViewport();
                gestureStart.current = null;
                if (s0 && (s0.x !== v.x || s0.y !== v.y || s0.zoom !== v.zoom)) return; // it was a drag
                onSelect(null);
              }}
              fitView={!initialViewport}
              fitViewOptions={{ padding: 0.15 }}
              defaultViewport={initialViewport ?? undefined}
              // A user pan/zoom (event present; programmatic moves have none) keeps their view.
              onMoveStart={(event, v) => {
                if (!event) return;
                gestureStart.current = v;
              }}
              onMoveEnd={(event, v) => {
                // Only a gesture that actually moved the view keeps the user's position.
                const s0 = gestureStart.current;
                if (event && s0 && (s0.x !== v.x || s0.y !== v.y || s0.zoom !== v.zoom)) restoreView.current = null;
                onViewportChange(v);
              }}
              minZoom={0.15}
              maxZoom={2.5}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-neutral-50" />
              {!selection && (
                <MiniMap
                  position="bottom-right"
                  pannable
                  zoomable
                  // MiniMap sets fill inline, so a Tailwind class can't override it.
                  nodeColor={(n) => (n.type === "ap" ? "rgb(99 102 241)" : "rgb(212 212 212)")}
                  className="!rounded-lg !border !border-neutral-200"
                />
              )}
              <Panel position="top-left" className="flex items-start gap-2">
                <TopologyLegend />
                <ZoomControls />
              </Panel>
            </ReactFlow>
          )}
          {selection && (
            <NodeDetailPanel network={network} selection={selection} onSelect={onSelect} onClose={() => onSelect(null)} />
          )}
        </div>
      </div>
    </TopologyUiContext.Provider>
  );
}

export function TopologyCanvas(props: TopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      {/* Keyed by network so expansion state resets when a different network loads. */}
      <Canvas key={props.network.topology.rootDeviceId} {...props} />
    </ReactFlowProvider>
  );
}
