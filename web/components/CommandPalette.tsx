"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/web/lib/utils";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { NAV_ITEMS } from "@/web/lib/navItems";
import { useAuth } from "@/web/contexts/AuthContext";
import type { Subscriber } from "@/web/lib/corteca/types";
import { subscriberKey, subscriberName } from "@/web/lib/subscriberSearch";

export const PALETTE_SUBSCRIBER_KEY = "corteca:palette-subscriber";
export const OPEN_PALETTE_EVENT = "corteca:open-command-palette";

const SUBSCRIBER_SEARCH_MIN_CHARS = 2;
const SUBSCRIBER_SEARCH_DEBOUNCE_MS = 250;

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function CommandPalette() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSubscribers([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < SUBSCRIBER_SEARCH_MIN_CHARS) {
      setSubscribers([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/subscribers?q=${encodeURIComponent(term)}&field=auto`);
        const data = await res.json();
        const list: Subscriber[] = data.results ?? [];
        setSubscribers(res.ok ? list.filter((s) => s.home_wifis?.[0]?.id).slice(0, 6) : []);
      } catch {
        setSubscribers([]);
      } finally {
        setSearching(false);
      }
    }, SUBSCRIBER_SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const matchingPages = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => item.title.toLowerCase().includes(term));
  }, [query]);

  function goToPage(href: string) {
    setOpen(false);
    router.push(href);
  }

  function goToSubscriber(subscriber: Subscriber) {
    setOpen(false);
    try {
      sessionStorage.setItem(PALETTE_SUBSCRIBER_KEY, JSON.stringify(subscriber));
    } catch { /* sessionStorage unavailable — palette still navigates, just without preselect */ }
    router.push("/network-visualizer");
  }

  if (!isAuthenticated) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2",
            "flex max-h-[70vh] flex-col overflow-hidden rounded-lg bg-white shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search for a page or subscriber and press Enter to navigate.
          </Dialog.Description>

          <div className="flex shrink-0 items-center gap-2.5 border-b border-neutral-200 px-4 py-3">
            <span className="text-neutral-400"><SearchIcon /></span>
            <input
              autoFocus
              type="text"
              placeholder="Search pages, or subscribers by name, email, MAC, serial…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              Esc
            </kbd>
          </div>

          <div className="flex-1 overflow-auto p-1.5">
            {query.trim().length >= SUBSCRIBER_SEARCH_MIN_CHARS && (
              <div className="mb-1">
                <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Subscribers {searching && "· searching…"}
                </p>
                {subscribers.length === 0 && !searching && (
                  <p className="px-2.5 py-1.5 text-xs text-neutral-400">No matching subscribers.</p>
                )}
                {subscribers.map((sub) => {
                  const net = sub.home_wifis?.[0];
                  const online = sub.home_wifis?.[0]?.status?.online;
                  return (
                    <button
                      key={subscriberKey(sub)}
                      type="button"
                      onClick={() => goToSubscriber(sub)}
                      className="flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-sm hover:bg-neutral-100"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-neutral-900">{subscriberName(sub)}</span>
                        <span className="truncate text-xs text-neutral-400">
                          {[sub.email, net?.id, net?.sn].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {sub.home_wifis?.[0]?.id && (
                        <span className="flex items-center gap-1.5 shrink-0 text-xs text-neutral-500">
                          <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-neutral-300")} />
                          {online ? "Online" : "Offline"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Pages
              </p>
              {matchingPages.length === 0 && (
                <p className="px-2.5 py-1.5 text-xs text-neutral-400">No matching pages.</p>
              )}
              {matchingPages.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => goToPage(item.href)}
                  className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm hover:bg-neutral-100"
                >
                  <span className="shrink-0 text-neutral-400 [&>svg]:h-[18px] [&>svg]:w-[18px]">{item.icon}</span>
                  <span className="font-medium text-neutral-900">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
