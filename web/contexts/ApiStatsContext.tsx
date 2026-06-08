"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { createSession, loadSessions, saveSessions } from "@/web/lib/sessionHistory";
import type { SessionRecord } from "@/web/lib/sessionHistory";

export interface ApiStats {
  calls: number;
  bytesSent: number;
  bytesReceived: number;
  rateLimitHits: number;
  sessionStart: number;
}

const zero = (): ApiStats => ({ calls: 0, bytesSent: 0, bytesReceived: 0, rateLimitHits: 0, sessionStart: Date.now() });
const Ctx  = createContext<ApiStats>(zero());

function persistSession(session: SessionRecord, keepalive = false) {
  fetch('/api/sessions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
    keepalive,
  }).catch(() => {});
}

export function ApiStatsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated }    = useAuth();
  const [stats, setStats]      = useState<ApiStats>(zero);
  const sessionRef             = useRef<SessionRecord | null>(null);
  const statsRef               = useRef<ApiStats>(zero());
  const saveTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { statsRef.current = stats; }, [stats]);

  const flush = useCallback((final = false) => {
    if (!sessionRef.current) return;
    const s = statsRef.current;
    const updated: SessionRecord = {
      ...sessionRef.current,
      calls: s.calls,
      bytesSent: s.bytesSent,
      bytesReceived: s.bytesReceived,
      rateLimitHits: s.rateLimitHits,
      endTime: final ? Date.now() : sessionRef.current.endTime,
    };

    // Keep localStorage in sync as a local cache
    const all = loadSessions();
    saveSessions(all.map((r) => r.id === updated.id ? updated : r));

    // Persist to DB (keepalive=true on final flush so it survives page unload)
    persistSession(updated, final);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 3000);
  }, [flush]);

  // Auth lifecycle — open/resume/close sessions
  useEffect(() => {
    if (!isAuthenticated) {
      flush(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      sessionRef.current = null;
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('corteca:sid');
      setStats(zero);
      return;
    }

    const sid      = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('corteca:sid') : null;
    const stored   = loadSessions();
    const existing = sid ? stored.find((r) => r.id === sid && !r.endTime) : null;

    if (existing) {
      sessionRef.current = existing;
      setStats({ calls: existing.calls, bytesSent: existing.bytesSent, bytesReceived: existing.bytesReceived, rateLimitHits: existing.rateLimitHits, sessionStart: existing.startTime });
    } else {
      const fresh = createSession();
      sessionRef.current = fresh;
      saveSessions([...stored, fresh]);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('corteca:sid', fresh.id);
      setStats(zero);
      // Create the session row in DB immediately
      persistSession(fresh);
    }
  }, [isAuthenticated, flush]);

  // Event listeners — accumulate stats and debounce-persist
  useEffect(() => {
    if (!isAuthenticated) return;

    const onCall = (e: Event) => {
      const { sent, received, isRl } = (e as CustomEvent<{ sent: number; received: number; isRl: boolean }>).detail;
      setStats((s) => ({ ...s, calls: s.calls + 1, bytesSent: s.bytesSent + sent, bytesReceived: s.bytesReceived + received, rateLimitHits: s.rateLimitHits + (isRl ? 1 : 0) }));
      scheduleSave();
    };
    const onBytes = (e: Event) => {
      setStats((s) => ({ ...s, bytesReceived: s.bytesReceived + (e as CustomEvent<number>).detail }));
      scheduleSave();
    };

    window.addEventListener('corteca:api-call', onCall);
    window.addEventListener('corteca:api-bytes', onBytes);
    return () => { window.removeEventListener('corteca:api-call', onCall); window.removeEventListener('corteca:api-bytes', onBytes); };
  }, [isAuthenticated, scheduleSave]);

  return <Ctx.Provider value={stats}>{children}</Ctx.Provider>;
}

export function useApiStats(): ApiStats { return useContext(Ctx); }
