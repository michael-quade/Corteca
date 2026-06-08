"use client";

import { useEffect, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/web/lib/utils";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { SwMatrixData, SwMatrixRow } from "@/app/api/sw-matrix/route";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SwMatrixModal({ open, onClose, onSaved }: Props) {
  const [models, setModels]   = useState<string[]>([]);
  const [rows, setRows]       = useState<SwMatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchWithAuth("/api/sw-matrix")
      .then((r) => r.json())
      .then((d: SwMatrixData) => { setModels(d.beaconModels); setRows(d.releases); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  const updateModel = useCallback((idx: number, newName: string) => {
    setModels((prev) => prev.map((m, i) => (i === idx ? newName : m)));
    setRows((prev) =>
      prev.map((row) => {
        const oldName = models[idx];
        if (!(oldName in row.builds)) return row;
        const builds = { ...row.builds, [newName]: row.builds[oldName] };
        delete builds[oldName];
        return { ...row, builds };
      }),
    );
  }, [models]);

  const updateReleaseName = (idx: number, name: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name } : r)));

  const updateCell = (rowIdx: number, model: string, value: string) =>
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, builds: { ...r.builds, [model]: value } } : r)),
    );

  const addRow = () =>
    setRows((prev) => [...prev, { name: "NEW_RELEASE", builds: {} }]);

  const deleteRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const addModel = () =>
    setModels((prev) => [...prev, "New Model"]);

  const deleteModel = (idx: number) => {
    const name = models[idx];
    setModels((prev) => prev.filter((_, i) => i !== idx));
    setRows((prev) =>
      prev.map((r) => {
        const builds = { ...r.builds };
        delete builds[name];
        return { ...r, builds };
      }),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/sw-matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beaconModels: models, releases: rows }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200";
  const headerInputCls = "w-full rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-semibold focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed inset-4 z-50 flex flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-neutral-900">SW Release Matrix</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-neutral-500">
                Edit beacon models (columns) and SW releases (rows). Build strings go in each cell.
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving || loading} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                {saving ? "Saving…" : "Save"}
              </button>
              <Dialog.Close className="ml-2 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Dialog.Close>
            </div>
          </div>

          {/* Body — single scroll container so sticky thead works */}
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-6 pt-4">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
              </div>
            ) : (
              <>
                <table className="border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm">
                    <tr>
                      {/* Release column header */}
                      <th className="sticky left-0 z-10 bg-white pb-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 min-w-[140px]">
                        Release
                      </th>
                      {models.map((model, mi) => (
                        <th key={mi} className="min-w-[130px] pb-2 pl-1 pr-1 align-bottom">
                          <div className="flex flex-col gap-1">
                            <input
                              value={model}
                              onChange={(e) => updateModel(mi, e.target.value)}
                              className={headerInputCls}
                              placeholder="Model name"
                            />
                            <button
                              type="button"
                              onClick={() => deleteModel(mi)}
                              className="self-center text-neutral-300 hover:text-red-500 transition-colors"
                              title="Remove column"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        </th>
                      ))}
                      {/* Add model button */}
                      <th className="pb-2 pl-3">
                        <button
                          type="button"
                          onClick={addModel}
                          className="whitespace-nowrap rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          + Model
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((row, ri) => (
                      <tr key={ri} className="group">
                        <td className="sticky left-0 z-10 bg-white py-1.5 pr-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => deleteRow(ri)}
                              className="shrink-0 text-neutral-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                              title="Remove row"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                            <input
                              value={row.name}
                              onChange={(e) => updateReleaseName(ri, e.target.value)}
                              className={cn(headerInputCls, "min-w-[120px]")}
                              placeholder="Release name"
                            />
                          </div>
                        </td>
                        {models.map((model, mi) => (
                          <td key={mi} className="py-1.5 pl-1 pr-1">
                            <input
                              value={row.builds[model] ?? ""}
                              onChange={(e) => updateCell(ri, model, e.target.value)}
                              className={cn(inputCls, "font-mono")}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={addRow}
                  className="mt-3 rounded-md border border-dashed border-neutral-300 px-4 py-2 text-xs text-neutral-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Add Release Row
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
