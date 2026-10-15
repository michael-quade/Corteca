"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/web/lib/utils";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import type { UnknownFirmwareEntry } from "@/app/api/sw-overview/route";
import { AssignFirmwareModal } from "@/web/components/modals/AssignFirmwareModal";

const CONSOLE_BASE = process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? 'https://console.demo2.homewifi.nokia.com';

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, '-')}`;
}

interface AssignTarget {
  firmware: string;
  derivedRelease: string | null;
}

interface HwGroup {
  model: string;
  items: UnknownFirmwareEntry[];
  total: number;
  online: number;
}

interface Props {
  items: UnknownFirmwareEntry[];
  onAssigned: () => void;
  /** Incrementing this opens the list (used by the Fleet health tile). */
  openRequest?: number;
}

function ChevronIcon({ open, className = "" }: { open: boolean; className?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${className}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function UnknownFirmwareList({ items, onAssigned, openRequest = 0 }: Props) {
  const [outerOpen, setOuterOpen]             = useState(false);
  useEffect(() => { if (openRequest > 0) setOuterOpen(true); }, [openRequest]);
  const [expandedGroups, setExpandedGroups]   = useState<Set<string>>(new Set());
  const [expandedFirmwares, setExpandedFirmwares] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget]       = useState<AssignTarget | null>(null);

  const groups: HwGroup[] = useMemo(() => {
    const map = new Map<string, UnknownFirmwareEntry[]>();
    for (const item of items) {
      const model = item.models[0] ?? "Unknown HW";
      if (!map.has(model)) map.set(model, []);
      map.get(model)!.push(item);
    }
    return Array.from(map.entries())
      .map(([model, entries]) => ({
        model,
        items: entries,
        total: entries.reduce((s, e) => s + e.total, 0),
        online: entries.reduce((s, e) => s + e.online, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  if (items.length === 0) return null;

  function toggleGroup(model: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model); else next.add(model);
      return next;
    });
  }

  function toggleFirmware(fw: string) {
    setExpandedFirmwares((prev) => {
      const next = new Set(prev);
      if (next.has(fw)) next.delete(fw); else next.add(fw);
      return next;
    });
  }

  const totalDevices  = items.reduce((s, i) => s + i.total,  0);
  const onlineDevices = items.reduce((s, i) => s + i.online, 0);

  return (
    <section id="unknown-firmware" className="scroll-mt-20 rounded-2xl bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-neutral-200/60">
      {/* Outer header */}
      <button
        type="button"
        onClick={() => setOuterOpen((o) => !o)}
        aria-expanded={outerOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <span className="flex flex-wrap items-center gap-2 text-lg font-semibold text-neutral-900">
            Unknown firmware
            <StatusPill tone="fair">{items.length} build{items.length !== 1 ? "s" : ""} · {totalDevices} devices</StatusPill>
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            Firmware strings not matched to any BBDR release &middot; {onlineDevices} of {totalDevices} devices online
          </span>
        </div>
        <ChevronIcon open={outerOpen} className="text-neutral-500" />
      </button>

      {outerOpen && (
        <div className="border-t border-neutral-200 px-5 pb-5">
          <div className="mt-4 space-y-3">
            {groups.map((group) => {
              const isGroupOpen = expandedGroups.has(group.model);
              return (
                <div key={group.model} className="overflow-hidden rounded-xl ring-1 ring-neutral-200">
                  {/* HW model header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.model)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-neutral-800">{group.model}</span>
                      <StatusPill tone="neutral">
                        {group.items.length} build{group.items.length !== 1 ? "s" : ""}
                      </StatusPill>
                      {!isGroupOpen && (
                        <span className="text-xs text-neutral-500">
                          {group.total} device{group.total !== 1 ? "s" : ""}{" "}
                          &middot; <span className="text-emerald-600">{group.online} online</span>
                        </span>
                      )}
                    </div>
                    <ChevronIcon open={isGroupOpen} className="text-neutral-400" />
                  </button>

                  {/* Firmware entries */}
                  {isGroupOpen && (
                    <div className="divide-y divide-neutral-200 border-t border-neutral-200">
                      {group.items.map((item) => {
                        const isFwOpen = expandedFirmwares.has(item.firmware);
                        return (
                          <div
                            key={item.firmware}
                            className="overflow-hidden"
                          >
                            {/* Firmware header row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
                              <button
                                type="button"
                                onClick={() => toggleFirmware(item.firmware)}
                                className="shrink-0"
                                title={isFwOpen ? "Hide devices" : "Show devices"}
                              >
                                <ChevronIcon open={isFwOpen} className="text-neutral-400" />
                              </button>
                              <span className="min-w-[160px] flex-1 font-mono font-semibold text-neutral-800">
                                {item.firmware || "(empty)"}
                              </span>
                              <span className="text-neutral-500">
                                {item.total} device{item.total !== 1 ? "s" : ""}
                                <span className="ml-1 text-emerald-600">({item.online} online)</span>
                              </span>
                              {item.derivedRelease && (
                                <StatusPill tone="info" className="font-mono">
                                  hint: {item.derivedRelease}
                                </StatusPill>
                              )}
                              <button
                                type="button"
                                onClick={() => setAssignTarget({ firmware: item.firmware, derivedRelease: item.derivedRelease })}
                                className="ml-auto shrink-0 text-xs font-semibold text-blue-600 underline-offset-2 hover:underline"
                              >
                                Assign to release
                              </button>
                            </div>

                            {/* Device list */}
                            {isFwOpen && item.devices.length > 0 && (
                              <div className="border-t border-neutral-100 bg-neutral-50/60 px-3 py-1">
                                {item.devices.map((device) => (
                                  <button
                                    key={device.mac}
                                    type="button"
                                    onClick={() => window.open(consoleUrl(device.mac), '_blank', 'noopener,noreferrer')}
                                    className="group flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-blue-50"
                                  >
                                    <span className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      device.online ? "bg-emerald-500" : "bg-neutral-300"
                                    )} />
                                    <span className="font-mono text-neutral-600">{device.mac}</span>
                                    {device.customerId && (
                                      <span className="text-neutral-400">{device.customerId}</span>
                                    )}
                                    <svg
                                      width="10" height="10" viewBox="0 0 12 12" fill="none"
                                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                      className="ml-auto shrink-0 text-neutral-300 transition-colors group-hover:text-blue-400"
                                    >
                                      <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
                                      <path d="M8 1h3v3M11 1 6 6"/>
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AssignFirmwareModal
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        firmware={assignTarget?.firmware ?? ""}
        initialRelease={assignTarget?.derivedRelease ?? undefined}
        onAssigned={() => {
          setAssignTarget(null);
          onAssigned();
        }}
      />
    </section>
  );
}
