"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { setApiLogInterceptor, type ApiCallLogEntry } from "@/web/lib/fetchWithAuth";

export interface ApiLogEntry {
  id: number;
  timestamp: Date;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  body: string | null;
}

interface ApiLogContextValue {
  entries: ApiLogEntry[];
  clear: () => void;
}

const ApiLogContext = createContext<ApiLogContextValue | null>(null);

export function ApiLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ApiLogEntry[]>([]);
  const counter = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    setEntries([]);
    counter.current = 0;
  }, [pathname]);

  useEffect(() => {
    setApiLogInterceptor((raw: ApiCallLogEntry) => {
      const id = ++counter.current;
      const entry: ApiLogEntry = {
        id,
        timestamp: raw.timestamp,
        method: raw.method,
        url: raw.url,
        status: raw.status,
        statusText: raw.statusText,
        durationMs: raw.durationMs,
        body: null,
      };
      setEntries((prev) => [entry, ...prev].slice(0, 200));

      raw.bodyPromise.then((body) => {
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, body } : e)));
      });
    });

    return () => setApiLogInterceptor(null);
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return (
    <ApiLogContext.Provider value={{ entries, clear }}>
      {children}
    </ApiLogContext.Provider>
  );
}

export function useApiLog(): ApiLogContextValue {
  const ctx = useContext(ApiLogContext);
  if (!ctx) throw new Error("useApiLog must be used within ApiLogProvider");
  return ctx;
}
