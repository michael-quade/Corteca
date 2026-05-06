"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { buildTree, buildPositions, buildLinkDataMap, linkTip, collectEdges, flatNodes, buildBoundingBox, CANVAS_W, LEVEL_H, PAD_TOP } from "@/web/lib/networkTopology";
import { filterConnectedDevices, computeDevicePositions, deviceColor, type DeviceNode } from "@/web/lib/networkMembers";

export interface NetworkTopologyData {
  networks: unknown; topology: unknown; mesh: unknown;
  configs?: Record<string, unknown>; members?: unknown; summary?: unknown; rootDeviceId: string;
}

interface Tooltip { label: string; sub: string; px: number; py: number }

// AP icon centred at origin
function RouterIcon({ online, isRoot }: { online: boolean; isRoot: boolean }) {
  const body = isRoot ? "#3b82f6" : online ? "#6366f1" : "#9ca3af";
  const led  = online ? "#22c55e" : "#6b7280";
  return (
    <g>
      {online && [0.35,0.62,0.9].map((op,i) => { const r=30-i*9; return <path key={i} d={`M${-r},-${r+28} A${r},${r} 0 0,1 ${r},-${r+28}`} fill="none" stroke={body} strokeWidth="2.5" strokeLinecap="round" opacity={op}/>; })}
      <line x1="-14" y1="-22" x2="-17" y2="-38" stroke={body} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14"  y1="-22" x2="17"  y2="-38" stroke={body} strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="-28" y="-22" width="56" height="36" rx="6" fill={body}/>
      <circle cx="-10" cy="-4" r="4.5" fill={led}/><circle cx="0" cy="-4" r="4.5" fill={led}/><circle cx="10" cy="-4" r="4.5" fill={led}/>
      <rect x="-22" y="14" width="44" height="6" rx="3" fill={body} opacity="0.55"/>
    </g>
  );
}

const SVG_H = 640;
const AP_R = 24; // radius used for line attachment
const DEV_R = 9;

// Offset a line's endpoints to node circumferences so lines don't pierce icons
function edgePts(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number) {
  const dx = x2 - x1 || 0.01, dy = y2 - y1 || 0.01, d = Math.sqrt(dx*dx+dy*dy);
  return { x1: x1+r1*dx/d, y1: y1+r1*dy/d, x2: x2-r2*dx/d, y2: y2-r2*dy/d };
}

export function NetworkTopologyMap({ data }: { data: NetworkTopologyData }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{sx:number;sy:number;ox:number;oy:number}|null>(null);
  const txRef   = useRef({ x: 0, y: 0, scale: 1 });
  const [tx, setTx]         = useState({ x: 0, y: 0, scale: 1 });
  const [tooltip, setTooltip] = useState<Tooltip|null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { tree, apPos, devPos, devices, edges, linkMap } = useMemo(() => {
    const tree    = buildTree(data.topology, data.networks, data.mesh, data.configs??{}, data.rootDeviceId);
    const apPos   = new Map<string,{x:number;y:number}>();
    buildPositions(tree, 0, 70, CANVAS_W-70, apPos);
    const devices = filterConnectedDevices(data.members);
    const devPos  = computeDevicePositions(devices, apPos, tree);
    const edges   = collectEdges(tree);
    const linkMap = buildLinkDataMap(data.mesh);
    return { tree, apPos, devPos, devices, edges, linkMap };
  }, [data]);

  // Fit view after layout computed
  useEffect(() => {
    const all = new Map([...apPos, ...devPos]);
    if (!all.size) return;
    const bb = buildBoundingBox(all);
    const svgW = svgRef.current?.clientWidth ?? 900;
    const cw = bb.maxX - bb.minX + 200, ch = bb.maxY - bb.minY + 200;
    const s  = Math.min(1.2, svgW / cw, SVG_H / ch);
    const nx = (svgW - cw*s)/2 - bb.minX*s + 100*s;
    const ny = (SVG_H - ch*s)/2 - bb.minY*s + 100*s;
    txRef.current = { x: nx, y: ny, scale: s };
    setTx({ x: nx, y: ny, scale: s });
  }, [apPos, devPos]);

  // Non-passive wheel zoom toward cursor
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      const ns = Math.max(0.08, Math.min(6, txRef.current.scale * f));
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const cx = (mx - txRef.current.x)/txRef.current.scale;
      const cy = (my - txRef.current.y)/txRef.current.scale;
      txRef.current = { x: mx-cx*ns, y: my-cy*ns, scale: ns };
      setTx({...txRef.current});
    };
    svg.addEventListener("wheel", h, { passive: false });
    return () => svg.removeEventListener("wheel", h);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: txRef.current.x, oy: txRef.current.y };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!dragRef.current) return;
    const { sx, sy, ox, oy } = dragRef.current;
    txRef.current = { ...txRef.current, x: ox+e.clientX-sx, y: oy+e.clientY-sy };
    setTx({...txRef.current}); setTooltip(null);
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const fitView = useCallback(() => {
    const all = new Map([...apPos, ...devPos]);
    const bb = buildBoundingBox(all);
    const svgW = svgRef.current?.clientWidth ?? 900;
    const cw = bb.maxX-bb.minX+200, ch = bb.maxY-bb.minY+200;
    const s = Math.min(1.2, svgW/cw, SVG_H/ch);
    txRef.current = { x:(svgW-cw*s)/2-bb.minX*s+100*s, y:(SVG_H-ch*s)/2-bb.minY*s+100*s, scale: s };
    setTx({...txRef.current});
  }, [apPos, devPos]);

  const apNodes = flatNodes(tree);
  const s = tx.scale;
  // Level-of-detail thresholds
  const showDevices      = s > 0.25;
  const showDeviceLabels = s > 0.6;
  const showApLabels     = s > 0.35;
  const showApIcons      = s > 0.4;

  const showTip = (label: string, sub: string, cx: number, cy: number) =>
    setTooltip({ label, sub, px: cx*s+tx.x, py: cy*s+tx.y });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs text-neutral-600">
        <div className="flex flex-wrap items-center gap-4">
          {[["#3b82f6",undefined,"Ethernet"],["#f97316","8,4","Mesh WiFi"],["#9ca3af",undefined,"Wired client"],["#9ca3af","5,3","WiFi client"]].map(([c,d,l])=>(
            <span key={l as string} className="flex items-center gap-1.5">
              <svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke={c as string} strokeWidth="2" strokeDasharray={d as string} strokeLinecap="round"/></svg>{l}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block"/>Gateway</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block"/>AP</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-neutral-300 inline-block"/>Device ({devices.length})</span>
        </div>
        <div className="flex gap-1">
          {[["−",0.85],["+",1.15]].map(([l,f])=>(
            <button key={l as string} type="button" onClick={()=>{txRef.current={...txRef.current,scale:Math.max(0.08,Math.min(6,txRef.current.scale*(f as number)))};setTx({...txRef.current});}} className="h-7 w-7 rounded border border-neutral-200 font-mono hover:bg-neutral-50">{l}</button>
          ))}
          <button type="button" onClick={fitView} className="h-7 rounded border border-neutral-200 px-2 hover:bg-neutral-50">Fit</button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        <svg ref={svgRef} width="100%" height={SVG_H} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={()=>{onMouseUp();setTooltip(null);}} onDoubleClick={fitView} style={{cursor:dragRef.current?"grabbing":"grab",display:"block"}}>
          <g transform={`translate(${tx.x},${tx.y}) scale(${tx.scale})`}>
            {/* AP–AP bezier edges */}
            {edges.map(({from,to})=>{
              const p=apPos.get(from),c=apPos.get(to); if(!p||!c) return null;
              const ld=linkMap.get(`${from}:${to}`)??linkMap.get(`${to}:${from}`); const eth=(ld?.medium??'').includes('eth'); const mid=(p.y+c.y)/2; const [tl,ts]=linkTip(ld);
              return <path key={`a:${from}:${to}`} d={`M${p.x} ${p.y+22} C${p.x} ${mid},${c.x} ${mid},${c.x} ${c.y-42}`} fill="none" stroke={eth?"#3b82f6":"#f97316"} strokeWidth="2.5" strokeDasharray={eth?undefined:"8,4"} strokeLinecap="round" onMouseEnter={()=>showTip(tl,ts,(p.x+c.x)/2,mid)} onMouseLeave={()=>setTooltip(null)}/>;
            })}
            {/* Device edges (offset to node boundaries) */}
            {showDevices && devices.map((d)=>{
              const ap=apPos.get(d.apId),dp=devPos.get(d.id); if(!ap||!dp) return null;
              const {x1,y1,x2,y2}=edgePts(ap.x,ap.y,dp.x,dp.y,AP_R,DEV_R);
              return <line key={`d:${d.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d1d5db" strokeWidth="1" strokeDasharray={d.wired?undefined:"5,3"}/>;
            })}
            {/* AP nodes */}
            {apNodes.map((node)=>{
              const pos=apPos.get(node.id); if(!pos) return null;
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`} style={{cursor:"default"}}
                  onMouseEnter={()=>showTip(node.label, node.id, pos.x, pos.y)}
                  onMouseLeave={()=>setTooltip(null)}>
                  {showApIcons ? <RouterIcon online={node.online} isRoot={node.isRoot}/> : <circle r={10} fill={node.isRoot?"#3b82f6":node.online?"#6366f1":"#9ca3af"}/>}
                  {showApLabels && <text y={showApIcons?37:18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#111827" style={{paintOrder:"stroke",stroke:"white",strokeWidth:3}}>{node.label}</text>}
                </g>
              );
            })}
            {/* Device nodes */}
            {showDevices && devices.map((d)=>{
              const pos=devPos.get(d.id); if(!pos) return null;
              return (
                <g key={d.id} transform={`translate(${pos.x},${pos.y})`} style={{cursor:"default"}}
                  onMouseEnter={()=>showTip(d.label,`${d.wired?"Wired":"WiFi"} · ${d.type}${d.ipv4?` · ${d.ipv4}`:""}`,pos.x,pos.y)}
                  onMouseLeave={()=>setTooltip(null)}>
                  <circle r={DEV_R} fill={deviceColor(d.type)} stroke="white" strokeWidth="1.5"/>
                  {showDeviceLabels && <text y={DEV_R+12} textAnchor="middle" fontSize="9" fill="#374151" style={{paintOrder:"stroke",stroke:"white",strokeWidth:2.5}}>{d.label}</text>}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div className="pointer-events-none absolute z-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: Math.min(tooltip.px+14, (svgRef.current?.clientWidth??900)-160), top: Math.max(4, tooltip.py-40) }}>
            <p className="text-xs font-semibold text-neutral-900">{tooltip.label}</p>
            <p className="text-xs text-neutral-500">{tooltip.sub}</p>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-neutral-400">Scroll to zoom · drag to pan · double-click to fit</p>
    </div>
  );
}
