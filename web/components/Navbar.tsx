"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/web/components/ui/Button";
import { LoginModal } from "@/web/components/modals/LoginModal";
import { useAuth } from "@/web/contexts/AuthContext";
import { cn } from "@/web/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard",      label: "Dashboard" },
  { href: "/devices",        label: "Devices" },
  { href: "/reboot-report",  label: "Reboot Report" },
];

export function Navbar() {
  const { isAuthenticated, email, isLoading, logout } = useAuth();
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
          <nav className="ml-6 flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname === link.href
                    ? "bg-neutral-100 font-medium text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
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
