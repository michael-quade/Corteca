"use client";

import { useEffect, useRef, useMemo } from "react";

export interface ColumnFilterProps {
  column: string;
  uniqueValues: string[];
  activeFilter: Set<string> | null; // null = all selected
  searchText: string;
  onSearchChange: (t: string) => void;
  onChange: (filter: Set<string> | null) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function ColumnFilter({
  column, uniqueValues, activeFilter, searchText,
  onSearchChange, onChange, onClose, position,
}: ColumnFilterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const visibleOptions = useMemo(() =>
    uniqueValues.filter((v) => v.toLowerCase().includes(searchText.toLowerCase())),
    [uniqueValues, searchText]
  );

  const isSelected = (v: string) => activeFilter === null || activeFilter.has(v);
  const selectedCount = activeFilter === null ? uniqueValues.length : activeFilter.size;
  const allSelected = activeFilter === null || activeFilter.size === uniqueValues.length;
  const noneSelected = activeFilter !== null && activeFilter.size === 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && !noneSelected;
    }
  }, [allSelected, noneSelected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", handler); window.removeEventListener("scroll", onScroll, true); };
  }, [onClose]);

  function toggleAll() {
    onChange(allSelected ? new Set() : null);
  }

  function toggleValue(v: string) {
    const base = activeFilter ?? new Set(uniqueValues);
    const next = new Set(base);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next.size === uniqueValues.length ? null : next);
  }

  const left = Math.min(position.left, window.innerWidth - 260);
  const top  = Math.min(position.top + 2, window.innerHeight - 320);

  return (
    <div
      ref={ref}
      data-filter-dropdown
      className="fixed z-[9999] w-60 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
      style={{ top, left }}
    >
      {/* Search */}
      <div className="border-b border-neutral-100 p-2">
        <input
          autoFocus
          type="text"
          placeholder={`Search ${column}…`}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
        />
      </div>

      {/* Select All */}
      <label className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
        <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-blue-600" />
        <span className="text-neutral-700">(Select All)</span>
      </label>

      {/* Value list */}
      <div className="max-h-48 overflow-y-auto">
        {visibleOptions.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-neutral-50">
            <input type="checkbox" checked={isSelected(v)} onChange={() => toggleValue(v)} className="accent-blue-600 shrink-0" />
            <span className="truncate text-neutral-700" title={v || "(blank)"}>{v || <em className="text-neutral-400">blank</em>}</span>
          </label>
        ))}
        {visibleOptions.length === 0 && <p className="px-3 py-2 text-xs text-neutral-400">No matches</p>}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-3 py-1.5">
        <span className="text-xs text-neutral-400">{selectedCount} of {uniqueValues.length} selected</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
