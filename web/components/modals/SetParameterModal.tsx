"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { SetParamTarget } from "./SetParameterModal.types";

export type { SetParamTarget };

interface Props {
  target: SetParamTarget | null;
  onClose: () => void;
  onSuccess: (param: string, newValue: string) => void;
}

export function SetParameterModal({ target, onClose, onSuccess }: Props) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setValue(target.currentValue ?? ""); setError(null); }
  }, [target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/network/${target.deviceId}/datamodel/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objPath: target.objPath, param: target.param.paramName, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSuccess(target.param.paramName, value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={target !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-base font-semibold text-neutral-900">
            Set Parameter
          </Dialog.Title>
          <p className="mb-1 break-all font-mono text-xs text-neutral-500">
            {target?.objPath}<span className="font-bold text-neutral-700">{target?.param.paramName}</span>
          </p>
          <p className="mb-4 text-xs text-neutral-400">
            Type: {target?.param.valueType}
            {target?.currentValue !== undefined && (
              <> · Current: <span className="font-mono">{target.currentValue || "(empty)"}</span></>
            )}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="New value"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Applying…" : "Set Value"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
