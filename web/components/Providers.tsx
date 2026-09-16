"use client";

import { AuthProvider } from "@/web/contexts/AuthContext";
import { ApiStatsProvider } from "@/web/contexts/ApiStatsContext";
import { ApiLogProvider } from "@/web/contexts/ApiLogContext";
import { ToastProvider } from "@/web/contexts/ToastContext";
import { Navbar } from "@/web/components/Navbar";
import { ReloginModal } from "@/web/components/modals/ReloginModal";
import { ApiLogPanel } from "@/web/components/ApiLogPanel";
import { ToastStack } from "@/web/components/ToastStack";
import { CommandPalette } from "@/web/components/CommandPalette";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ApiLogProvider>
        <ApiStatsProvider>
          <ToastProvider>
            <Navbar />
            <ReloginModal />
            <CommandPalette />
            {children}
            <ApiLogPanel />
            <ToastStack />
          </ToastProvider>
        </ApiStatsProvider>
      </ApiLogProvider>
    </AuthProvider>
  );
}
