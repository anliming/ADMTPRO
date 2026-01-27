import { createContext, useContext, useEffect, useMemo, useState } from "react";

type TokenContextValue = {
  token: string;
  setToken: (v: string) => void;
};

const TokenContext = createContext<TokenContextValue | null>(null);

const STORAGE_KEY = "admtpro_token";

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const value = useMemo(() => ({ token, setToken }), [token]);

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [token]);

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function useToken(): TokenContextValue {
  const ctx = useContext(TokenContext);
  if (!ctx) {
    throw new Error("useToken must be used within TokenProvider");
  }
  return ctx;
}
