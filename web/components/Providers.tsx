"use client";

import { AuthProvider } from "@/web/contexts/AuthContext";
import { Navbar } from "@/web/components/Navbar";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      {children}
    </AuthProvider>
  );
}
