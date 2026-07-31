"use client";

// Sessao do console. Hoje e um mock em localStorage (sem backend ainda). A
// interface (session, signIn, signOut, ready) e o que as telas consomem, entao
// trocar por Supabase Auth depois nao toca em nenhuma pagina: so este arquivo.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Session = {
  email: string;
  handle: string;
  displayName: string;
  role: string;
};

type AuthContextValue = {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "wondershield.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      // ignora storage indisponivel
    }
    setReady(true);
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    // MOCK: qualquer credencial nao-vazia entra. Substituir por Supabase Auth.
    if (!email.trim() || !password.trim()) {
      return { ok: false, error: "Preencha e-mail e senha." };
    }
    const handle = email.split("@")[0] || "operador";
    const next: Session = {
      email: email.trim(),
      handle,
      displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
      role: "member",
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignora
    }
    setSession(next);
    return { ok: true };
  };

  const signOut = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa do AuthProvider");
  return ctx;
}
