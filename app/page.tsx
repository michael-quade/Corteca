"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/web/contexts/AuthContext";

export default function HomePage() {
  const { isAuthenticated, isLoading, refreshSession } = useAuth();
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleLaunch() {
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/auto-login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Authentication failed.");
      await refreshSession();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed. Please try again.");
      setLaunching(false);
    }
  }

  if (isLoading || isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-10 overflow-hidden p-8">
      {/* Background image */}
      <Image
        src="/nokia-logo.jpg"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />

      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-10">
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
          Corteca Vibe Project
        </h1>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="min-w-72 rounded-md bg-white px-8 py-4 text-lg font-semibold text-neutral-900 shadow-lg transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-60"
          >
            {launching ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-800" />
                Launching…
              </span>
            ) : (
              "Launch Corteca Vibe Project"
            )}
          </button>

          {error && (
            <p className="max-w-sm rounded-md bg-black/40 px-4 py-2 text-center text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
