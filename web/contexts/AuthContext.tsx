"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  isLoading: boolean;
  sessionExpired: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** How long the re-login dialog waits on the page before an expired session is signed out. */
const RELOGIN_GRACE_MS = 5 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    email: null,
    isLoading: true,
    sessionExpired: false,
  });

  // Bootstrap session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setState((s) => ({ ...s, isAuthenticated: data.authenticated, email: data.email ?? null, isLoading: false })))
      .catch(() => setState((s) => ({ ...s, isLoading: false })));
  }, []);

  // Listen for 401s fired by fetchWithAuth across all pages. The page stays as it
  // is (isAuthenticated is left alone) with ReloginModal on top.
  useEffect(() => {
    const handler = () =>
      setState((s) => ({ ...s, sessionExpired: true }));
    window.addEventListener("corteca:session-expired", handler);
    return () => window.removeEventListener("corteca:session-expired", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed.");
    setState({ isAuthenticated: true, email: data.email, isLoading: false, sessionExpired: false });
  }, []);

  // Sign out lands on the login page ("/"). The jump (effect below) waits for the
  // commit that marks the user signed out, so ApiStatsProvider (a child, whose
  // effects run first) has already flushed the session with keepalive.
  const goHome = useRef(false);
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    goHome.current = true;
    setState({ isAuthenticated: false, email: null, isLoading: false, sessionExpired: false });
  }, []);

  // Expired session: RELOGIN_GRACE_MS to sign back in on the same page, then
  // sign out and go to the login page. Signing back in clears the timer.
  useEffect(() => {
    if (!state.sessionExpired) return;
    const timer = setTimeout(() => { void logout(); }, RELOGIN_GRACE_MS);
    return () => clearTimeout(timer);
  }, [state.sessionExpired, logout]);

  // Signed out anywhere but the login/gate pages → the login page. Covers sign-out
  // and opening any dashboard without a session (pages only show a spinner then).
  // An expired session is left to ReloginModal.
  useEffect(() => {
    if (state.isLoading || state.isAuthenticated || state.sessionExpired) return;
    const onPublicPage = ["/", "/gate"].includes(window.location.pathname);
    if (onPublicPage && !goHome.current) return;
    goHome.current = false;
    // Full load: clears page state and shows the login page even if already on "/".
    window.location.assign("/");
  }, [state.isLoading, state.isAuthenticated, state.sessionExpired]);

  const refreshSession = useCallback(async () => {
    const data = await fetch("/api/auth/session").then((r) => r.json());
    setState((s) => ({ ...s, isAuthenticated: data.authenticated, email: data.email ?? null, isLoading: false }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
