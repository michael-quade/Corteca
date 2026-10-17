"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/web/lib/utils";
import { NAV_ITEMS } from "@/web/lib/navItems";

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors",
            "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
          )}
        >
          <MenuIcon />
          Menu
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 w-72 rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <nav className="flex max-h-[70vh] flex-col gap-0.5 overflow-auto">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  <span className={cn("mt-0.5 shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]", active ? "text-blue-600" : "text-neutral-400")}>
                    {item.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium leading-tight">{item.title}</span>
                    <span className={cn("mt-0.5 text-xs leading-snug", active ? "text-blue-600/80" : "text-neutral-400")}>
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
