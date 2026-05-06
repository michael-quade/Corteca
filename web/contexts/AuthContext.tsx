"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

  // Listen for 401s fired by fetchWithAuth across all pages
  useEffect(() => {
    const handler = () =>
      setState((s) => ({ ...s, isAuthenticated: false, sessionExpired: true }));
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

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ isAuthenticated: false, email: null, isLoading: false, sessionExpired: false });
  }, []);

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
