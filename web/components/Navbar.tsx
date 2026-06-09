"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/web/components/ui/Button";
import { LoginModal } from "@/web/components/modals/LoginModal";
import { useAuth } from "@/web/contexts/AuthContext";
import { useApiStats } from "@/web/contexts/ApiStatsContext";
import { cn } from "@/web/lib/utils";

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}MB`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}KB`;
  return `${n}B`;
}

const NAV_LINKS = [
  { href: "/dashboard",  label: "Dashboard"  },
  { href: "/api-usage",  label: "API Usage"  },
];

export function Navbar() {
  const { isAuthenticated, email, isLoading, logout } = useAuth();
  const stats = useApiStats();
  const [loginOpen, setLoginOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-neutral-200 bg-white px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-neutral-900 hover:text-neutral-700"
        >
          Corteca
        </Link>

        {isAuthenticated && (
          <nav className="ml-6 flex items-center gap-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {isAuthenticated && (
          <div className="ml-auto mr-3 flex items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1 font-mono text-[11px] text-neutral-400">
            <span className="font-semibold uppercase tracking-wide text-neutral-500 not-italic" style={{ fontFamily: "inherit" }}>Session</span>
            <span className="text-neutral-300">·</span>
            <span title="API calls this session">{stats.calls} calls</span>
            <span className="text-neutral-300">·</span>
            <span title="Bytes sent to Corteca">↑{fmtBytes(stats.bytesSent)}</span>
            <span title="Bytes received from Corteca">↓{fmtBytes(stats.bytesReceived)}</span>
            {stats.rateLimitHits > 0 && (
              <><span className="text-neutral-300">·</span><span className="text-amber-500 font-medium" title="Rate limit hits requiring backoff">⚠ {stats.rateLimitHits} throttled</span></>
            )}
          </div>
        )}
        <div className={cn("flex items-center gap-3", isAuthenticated ? "" : "ml-auto")}>
          {isLoading ? (
            <span className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
          ) : isAuthenticated ? (
            <>
              <span className="flex items-center gap-1.5 text-sm text-neutral-600">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {email}
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setLoginOpen(true)}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
