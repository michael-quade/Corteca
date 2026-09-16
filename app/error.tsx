"use client";

import { useEffect } from "react";
import { Button } from "@/web/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-neutral-500">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
