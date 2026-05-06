"use client";

import { AuthProvider } from "@/web/contexts/AuthContext";
import { ApiStatsProvider } from "@/web/contexts/ApiStatsContext";
import { Navbar } from "@/web/components/Navbar";
import { ReloginModal } from "@/web/components/modals/ReloginModal";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ApiStatsProvider>
        <Navbar />
        <ReloginModal />
        {children}
      </ApiStatsProvider>
    </AuthProvider>
  );
}
