"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Subscriber } from "@/web/lib/corteca/types";
import { loadRecentNetworks } from "@/web/lib/recentNetworks";
import { parseViewState } from "@/web/lib/topologySelection";
import {
  MAX_NETWORK_TABS, freshView, isBusy, loadOpenTabs, saveOpenTabs,
  type NetworkTab, type TabStatus,
} from "@/web/lib/networkTabs";

export interface PendingOpen { networkId: string; subscriber: Subscriber | null }

const recentEntry = (networkId: string) => loadRecentNetworks().find((r) => r.networkId === networkId);
const knownSubscriber = (networkId: string) => recentEntry(networkId)?.subscriber ?? null;

/**
 * The MCP visualizer's open networks: up to MAX_NETWORK_TABS tabs, each kept loaded
 * so switching never re-asks MCP. Opening a network that is already open switches to
 * it; opening one more than the limit parks it in `pending` until a tab is closed.
 * Restored after a reload (sessionStorage), plus any network named in the URL.
 */
export function useNetworkTabs(enabled: boolean) {
  const [tabs, setTabs] = useState<NetworkTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOpen | null>(null);
  const [status, setStatus] = useState<Record<string, TabStatus>>({});
  // Tabs whose load, refresh or AI run finished while another tab was showing.
  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const statusRef = useRef(status);

  // Restore once signed in: stored tabs, then the URL's network (a shared link or the reload's own).
  useEffect(() => {
    if (!enabled || ready) return;
    const stored = loadOpenTabs();
    const url = parseViewState(window.location.search);
    const restored: NetworkTab[] = stored.tabs.map((t) => ({
      ...t,
      gatewayModel: recentEntry(t.networkId)?.gatewayModel,
      initialView: t.networkId === url.network ? url : freshView(t.networkId),
    }));
    let active = stored.activeId;
    if (url.network) {
      if (restored.some((t) => t.networkId === url.network)) active = url.network;
      else if (restored.length < MAX_NETWORK_TABS) {
        restored.push({ networkId: url.network, subscriber: knownSubscriber(url.network), gatewayModel: recentEntry(url.network)?.gatewayModel, initialView: url });
        active = url.network;
      } else setPending({ networkId: url.network, subscriber: knownSubscriber(url.network) });
    }
    setTabs(restored);
    setActiveId(active);
    setReady(true);
  }, [enabled, ready]);

  useEffect(() => { if (ready) saveOpenTabs(tabs, activeId); }, [tabs, activeId, ready]);

  const activate = useCallback((id: string) => {
    setActiveId(id);
    setUnseen((u) => { if (!u.has(id)) return u; const n = new Set(u); n.delete(id); return n; });
  }, []);

  /** Adds a tab to `list` (or switches to it) and makes it active; null when there is no room. */
  const withOpened = useCallback((list: NetworkTab[], req: PendingOpen): NetworkTab[] | null => {
    const existing = list.find((t) => t.networkId === req.networkId);
    if (existing) {
      // A search may name the subscriber of a network first opened from a shared link.
      return req.subscriber && !existing.subscriber
        ? list.map((t) => (t === existing ? { ...t, subscriber: req.subscriber } : t))
        : list;
    }
    if (list.length >= MAX_NETWORK_TABS) return null;
    // The layout choice carries over from the tab on screen.
    const layout = activeRef.current ? statusRef.current[activeRef.current]?.layout : undefined;
    return [...list, {
      networkId: req.networkId, subscriber: req.subscriber,
      gatewayModel: recentEntry(req.networkId)?.gatewayModel, initialView: freshView(req.networkId, layout),
    }];
  }, []);

  const open = useCallback((networkId: string, subscriber: Subscriber | null) => {
    const req = { networkId, subscriber: subscriber ?? knownSubscriber(networkId) };
    const next = withOpened(tabs, req);
    if (!next) { setPending(req); return; }
    setTabs(next);
    activate(networkId);
  }, [tabs, withOpened, activate]);

  const remove = useCallback((list: NetworkTab[], id: string) => {
    const rest = { ...statusRef.current };
    delete rest[id];
    statusRef.current = rest;
    setStatus(rest);
    setUnseen((u) => { if (!u.has(id)) return u; const n = new Set(u); n.delete(id); return n; });
    return list.filter((t) => t.networkId !== id);
  }, []);

  const close = useCallback((id: string) => {
    const i = tabs.findIndex((t) => t.networkId === id);
    if (i < 0) return;
    const next = remove(tabs, id);
    setTabs(next);
    // Closing the tab on screen shows its right-hand neighbour (else the left one).
    if (activeId === id) {
      const neighbour = next[Math.min(i, next.length - 1)]?.networkId ?? null;
      if (neighbour) activate(neighbour); else setActiveId(null);
    }
  }, [tabs, activeId, remove, activate]);

  /** Limit dialog: close one tab and open the network that was waiting. */
  const closeAndOpenPending = useCallback((id: string) => {
    if (!pending) return;
    const next = withOpened(remove(tabs, id), pending);
    if (!next) return;
    setTabs(next);
    activate(pending.networkId);
    setPending(null);
  }, [pending, tabs, remove, withOpened, activate]);

  const report = useCallback((id: string, s: TabStatus) => {
    const was = statusRef.current[id];
    if (isBusy(was) && !isBusy(s) && id !== activeRef.current) setUnseen((u) => new Set(u).add(id));
    statusRef.current = { ...statusRef.current, [id]: s };
    setStatus(statusRef.current);
  }, []);

  return {
    tabs, activeId, status, unseen, pending, ready,
    open, close, activate, report, closeAndOpenPending,
    cancelPending: () => setPending(null),
  };
}
