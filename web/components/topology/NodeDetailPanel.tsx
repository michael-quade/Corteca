"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/web/lib/utils";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName } from "@/web/lib/topologyFlow";
import type { Selection } from "@/web/lib/topologySelection";
import { ClientDetails } from "./ClientDetails";
import { ApDetails } from "./ApDetails";
import { LinkDetails } from "./LinkDetails";
import { SwitchDetails } from "./SwitchDetails";
import { WanDetails } from "./WanDetails";
import { switchById } from "@/web/lib/inferredSwitches";
import { memberIdentity } from "@/web/lib/deviceNames";
import { useDeviceRename, type RenameTarget } from "./DeviceRename";
import { SectionChips, SectionOrderReset } from "./SectionChips";
import { apLabel } from "./DetailParts";
import { useCanvasOverlay } from "./CanvasOverlay";
import { IconButton } from "@/web/components/events/EventsChrome";
import { ResizeGrip, useResizeDrag } from "@/web/components/ui/ResizeGrip";
import {
  PANEL_GAP, PANEL_MIN, PanelLayoutContext, ROOMY_PANEL, WIDE_PANEL, type DetailPanelState, type PanelLayout,
} from "./useDetailPanel";

type Select = (sel: Selection) => void;

/**
 * The right-hand detail panel (AP, client, link, switch, WAN), framed like the events drawer:
 * resizable from its left edge (one width for every kind, up to half the canvas), and ⤢
 * expands it over the whole diagram (Esc / "Back to panel" returns). From ROOMY_PANEL wide its
 * content goes two-up (`data-roomy`, `PanelLayoutContext`), from WIDE_PANEL three-up.
 */
export function NodeDetailPanel({ network, selection, onSelect, onClose, panel, top = PANEL_GAP }: {
  network: McpNetwork;
  selection: Selection;
  onSelect: Select;
  onClose: () => void;
  panel: DetailPanelState;
  /** Distance from the canvas top (the folded Network summary row sits above it). */
  top?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  const rename = useDeviceRename();
  const overlay = useCanvasOverlay();
  const [boxW, setBoxW] = useState(PANEL_MIN);
  const resize = useResizeDrag({ side: "left", width: panel.width, min: PANEL_MIN, max: panel.max, onCommit: panel.setWidth });
  const selKey = `${selection.kind}:${selection.id}`;
  // Another device starts at the top of the panel (the scroll area is reused between them).
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [selKey]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  });
  useEffect(() => { if (panel.expanded) boxRef.current?.focus({ preventScroll: true }); }, [panel.expanded]);
  const layout = useMemo<PanelLayout>(() => ({ roomy: boxW >= ROOMY_PANEL, wide: boxW >= WIDE_PANEL }), [boxW]);

  const ap = selection.kind === "ap" ? network.aps.find((a) => a.mac === selection.id) : undefined;
  const member = selection.kind === "client" ? network.members.find((m) => m.id === selection.id) : undefined;
  const link = selection.kind === "link" ? network.backhaul.find((l) => l.childMac === selection.id) : undefined;
  const sw = selection.kind === "switch" ? switchById(network, selection.id) : undefined;
  const wanGateway = selection.kind === "wan" ? network.aps.find((a) => a.mac === selection.id && a.role === "root") : undefined;
  if (!ap && !member && !link && !sw && !wanGateway) return null;

  const title = ap ? apLabel(ap) : member ? clientName(member) : sw ? `Switch on ${sw.port}` : wanGateway ? "Internet" : "Backhaul link";
  const kicker = ap ? "Access point" : member ? "Client" : sw ? "Switch (inferred)" : wanGateway ? "WAN" : "Link";
  const renameTarget: RenameTarget | null = ap
    ? { mac: ap.mac, kind: "Beacon", description: `${ap.model} · ${ap.mac}` }
    : member
      ? { mac: member.id, kind: "client", description: `${memberIdentity(member).autoAlias ?? (member as { hostname?: string }).hostname ?? "Client"} · ${member.id}` }
      : null;
  const canRename = !!renameTarget && !!rename?.canRename(renameTarget.mac);
  const expanded = panel.expanded;

  return (
    <aside
      ref={boxRef}
      aria-label={`${kicker} details`}
      tabIndex={expanded ? -1 : undefined}
      data-canvas-overlay={expanded ? "" : undefined}
      data-roomy={layout.roomy ? "" : undefined}
      data-wide={layout.wide ? "" : undefined}
      onKeyDown={expanded ? (e) => {
        // The canvas's own keys stay off while this covers it; Esc first closes an open map.
        e.stopPropagation();
        if (e.key === "Escape" && !overlay?.open) panel.setExpanded(false);
      } : undefined}
      style={expanded ? undefined : { width: resize.width, top, right: PANEL_GAP, bottom: PANEL_GAP }}
      className={cn(
        "group/panel absolute flex max-w-[calc(100%-1.5rem)] flex-col rounded-xl border border-neutral-200 bg-white shadow-lg focus:outline-none",
        expanded ? "inset-3 z-20 max-w-none" : "z-10"
      )}
    >
      <header className="flex items-start gap-1.5 border-b border-neutral-100 py-2 pl-3.5 pr-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{kicker}</p>
          <h3 className="flex items-start gap-1.5 break-words text-sm font-semibold text-neutral-900">
            {title}
            {canRename && (
              <button
                type="button"
                onClick={() => rename!.start(renameTarget!)}
                aria-label={`Rename ${title}`}
                className="mt-px flex-shrink-0 rounded p-0.5 text-neutral-400 hover:bg-blue-50 hover:text-blue-600"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
            )}
          </h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5 self-center">
          {expanded ? (
            <button
              type="button"
              onClick={() => panel.setExpanded(false)}
              title="Back to panel (Esc)"
              className="mr-1 inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 4v6H4M14 20v-6h6M4 10l6-6M20 14l-6 6" />
              </svg>
              Back to panel
            </button>
          ) : (
            <IconButton label="Expand over the diagram" onClick={() => panel.setExpanded(true)}>
              <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
            </IconButton>
          )}
          <SectionOrderReset kind={selection.kind} />
          <IconButton label="Close details" onClick={onClose} muted>
            <path d="M18 6 6 18M6 6l12 12" />
          </IconButton>
        </div>
      </header>
      <SectionChips scrollRef={scrollRef} resetKey={selKey} kind={selection.kind} />
      {/* A flex column: the sections' CSS order follows the user's chip order (SectionChips). */}
      <PanelLayoutContext.Provider value={layout}>
        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto rounded-b-xl">
          {ap && <ApDetails network={network} ap={ap} onSelect={onSelect} />}
          {member && <ClientDetails network={network} member={member} onSelect={onSelect} />}
          {link && <LinkDetails network={network} link={link} onSelect={onSelect} />}
          {sw && <SwitchDetails network={network} sw={sw} onSelect={onSelect} />}
          {wanGateway && <WanDetails network={network} gateway={wanGateway} onSelect={onSelect} />}
        </div>
      </PanelLayoutContext.Provider>
      {!expanded && (
        <ResizeGrip side="left" label="Drag to resize the details panel" {...resize} onReset={() => panel.setWidth(PANEL_MIN)} />
      )}
    </aside>
  );
}
