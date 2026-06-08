"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function GatePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm " +
    "placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none " +
    "focus:ring-2 focus:ring-blue-100 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900">Corteca Portal</h1>
          <p className="mt-1 text-sm text-neutral-500">Enter your access credentials to continue</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="gate-username" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Username
              </label>
              <input
                id="gate-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className={inputCls}
                placeholder="Username"
              />
            </div>

            <div>
              <label htmlFor="gate-password" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Password
              </label>
              <input
                id="gate-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
