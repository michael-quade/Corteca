"use client";

import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/web/components/ui/Button";
import type { RenameDeviceModalProps } from "./RenameDeviceModal.types";

const MAX = 64;

/** Edit a Beacon's or client's nickname (HostAlias on the customer's gateway). */
export function RenameDeviceModal({ isOpen, onClose, kind, description, currentAlias, onSave }: RenameDeviceModalProps) {
  const [alias, setAlias] = useState(currentAlias);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setAlias(currentAlias); setError(null); setSaving(false); }
  }, [isOpen, currentAlias]);

  const trimmed = alias.trim();
  const unchanged = trimmed === currentAlias.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold text-neutral-900">Rename {kind}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-neutral-500">{description}</Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm text-neutral-700">
              Nickname
              <input
                autoFocus
                value={alias}
                maxLength={MAX}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="e.g. Living Room"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </label>
            <p className="text-xs text-neutral-500">
              Saved on the customer&apos;s gateway, so it also shows in the Corteca console and app. Leave empty to remove the nickname.
            </p>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || unchanged}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
