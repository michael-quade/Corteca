"use client";

import { AuthProvider } from "@/web/contexts/AuthContext";
import { ApiStatsProvider } from "@/web/contexts/ApiStatsContext";
import { ApiLogProvider } from "@/web/contexts/ApiLogContext";
import { Navbar } from "@/web/components/Navbar";
import { ReloginModal } from "@/web/components/modals/ReloginModal";
import { ApiLogPanel } from "@/web/components/ApiLogPanel";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ApiLogProvider>
        <ApiStatsProvider>
          <Navbar />
          <ReloginModal />
          {children}
          <ApiLogPanel />
        </ApiStatsProvider>
      </ApiLogProvider>
    </AuthProvider>
  );
}
