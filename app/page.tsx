"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/web/contexts/AuthContext";

export default function HomePage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      // AuthContext sets isAuthenticated → useEffect redirects to /dashboard
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setLoading(false);
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
    <main className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden p-8">
      <Image src="/nokia-logo.jpg" alt="" fill className="object-cover object-center" priority />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-white drop-shadow-lg">
          Corteca Vibe Project
        </h1>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-md">
          <p className="mb-6 text-center text-sm font-medium text-white/80">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Username</label>
              <input
                type="text" autoComplete="username" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Username"
                className="w-full rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/50 focus:bg-white/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Password</label>
              <input
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-white/50 focus:bg-white/20"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-200">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="mt-2 w-full rounded-lg bg-white py-3 text-sm font-semibold text-neutral-900 shadow transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-800" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
