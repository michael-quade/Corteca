"use client";

import { Notice } from "@/web/components/corteca/Notice";

/** Loading spinner / error notice shown in place of a view's content while it has no data. */
export function ViewStatus({ loading, error, what }: { loading: boolean; error: string | null; what: string }) {
  if (error) return <Notice tone="error" title={`Couldn't load ${what}`}>{error}</Notice>;
  if (!loading) return null;
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-neutral-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
      Reading {what} from Corteca…
    </div>
  );
}
