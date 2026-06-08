"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { SwMatrixData } from "@/app/api/sw-matrix/route";

interface Props {
  open: boolean;
  onClose: () => void;
  firmware: string;
  initialRelease?: string;
  onAssigned: () => void;
}

export function AssignFirmwareModal({ open, onClose, firmware, initialRelease, onAssigned }: Props) {
  const [matrix, setMatrix]   = useState<SwMatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [release, setRelease] = useState("");
  const [model, setModel]     = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setRelease(initialRelease ?? "");
    setModel("");
    fetchWithAuth("/api/sw-matrix")
      .then((r) => r.json())
      .then((d: SwMatrixData) => {
        setMatrix(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open, initialRelease]);

  const handleSave = async () => {
    if (!matrix || !release.trim() || !model.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const releases = matrix.releases.map((r) => ({ ...r, builds: { ...r.builds } }));
      const idx = releases.findIndex((r) => r.name === release.trim());
      if (idx >= 0) {
        releases[idx].builds[model] = firmware;
      } else {
        releases.push({ name: release.trim(), builds: { [model]: firmware } });
      }

      const beaconModels = matrix.beaconModels.includes(model)
        ? matrix.beaconModels
        : [...matrix.beaconModels, model];

      const res = await fetchWithAuth("/api/sw-matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beaconModels, releases }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onAssigned();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const releaseNames  = matrix?.releases.map((r) => r.name) ?? [];
  const beaconModels  = matrix?.beaconModels ?? [];
  const canSave       = !saving && !loading && release.trim().length > 0 && model.trim().length > 0;

  const inputCls = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-neutral-900">Assign Firmware Build</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-neutral-500">
                Map this build string to a release and beacon model in the SW Matrix.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5">
            {/* Firmware read-only display */}
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500">Firmware Build</p>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm text-neutral-800 break-all">
                {firmware || "(empty)"}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
              </div>
            ) : (
              <>
                {/* Release combobox */}
                <div>
                  <label htmlFor="assign-release" className="mb-1 block text-xs font-medium text-neutral-700">
                    Release Name
                  </label>
                  <input
                    id="assign-release"
                    list="assign-releases-datalist"
                    value={release}
                    onChange={(e) => setRelease(e.target.value)}
                    placeholder="e.g. BBDR2403"
                    className={inputCls}
                  />
                  <datalist id="assign-releases-datalist">
                    {releaseNames.map((r) => <option key={r} value={r} />)}
                  </datalist>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Select an existing release or type a new name to create one.
                  </p>
                </div>

                {/* Beacon model combobox */}
                <div>
                  <label htmlFor="assign-model" className="mb-1 block text-xs font-medium text-neutral-700">
                    Beacon Model
                  </label>
                  <input
                    id="assign-model"
                    list="assign-models-datalist"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Beacon 6"
                    className={inputCls}
                  />
                  <datalist id="assign-models-datalist">
                    {beaconModels.map((m) => <option key={m} value={m} />)}
                  </datalist>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Select an existing model or type a new name to create one.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Assign"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
