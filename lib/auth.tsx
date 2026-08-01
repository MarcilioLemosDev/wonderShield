"use client";

// Sessão do console. Usa Supabase Auth quando o projeto está configurado
// (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY); caso contrário cai num mock em
// localStorage, para o preview continuar navegável sem backend. As telas só
// consomem { session, ready, signIn, signOut }, então a troca é transparente.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { resolveLoginEmail } from "@/lib/handle";

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

// Deriva a sessão a partir do usuário do Supabase. handle e nome vêm do perfil;
// o papel vem da função my_role(), não da coluna — a leitura de profiles.role é
// revogada para que um membro não consiga listar quem são os administradores.
async function sessionFromUser(supabase: SupabaseClient, user: User): Promise<Session> {
  const email = user.email ?? "";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  let handle =
    (typeof meta.handle === "string" && meta.handle) || email.split("@")[0] || "operador";
  let displayName =
    (typeof meta.display_name === "string" && meta.display_name) ||
    handle.charAt(0).toUpperCase() + handle.slice(1);
  let role = "member";

  try {
    const { data } = await supabase
      .from("profiles")
      .select("handle, display_name")
      .eq("id", user.id)
      .single();
    if (data) {
      handle = data.handle ?? handle;
      displayName = data.display_name ?? displayName;
    }
  } catch {
    // sem perfil ainda / RLS: mantém os defaults do metadata
  }

  // Caminho principal: a função (a coluna role é revogada para membros).
  let resolvido = false;
  try {
    const { data, error } = await supabase.rpc("my_role");
    if (!error && typeof data === "string") {
      role = data;
      resolvido = true;
    }
  } catch {
    // segue para o caminho alternativo
  }

  // Alternativa: bancos onde a migration de blindagem ainda não rodou, ou o
  // cache de esquema do PostgREST ainda não enxerga a função. Sem isso, um
  // administrador legítimo apareceria como membro comum.
  if (!resolvido) {
    try {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (data && typeof data.role === "string") role = data.role;
    } catch {
      // permanece 'member'
    }
  }

  return { email, handle, displayName, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    // --- modo Supabase ---
    if (supabase) {
      let active = true;
      supabase.auth.getSession().then(async ({ data }) => {
        if (!active) return;
        const next = data.session ? await sessionFromUser(supabase, data.session.user) : null;
        if (!active) return;
        setSession(next);
        setReady(true);
      });
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
        const next = s ? await sessionFromUser(supabase, s.user) : null;
        setSession(next);
      });
      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }

    // --- modo mock (sem backend) ---
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      // ignora storage indisponível
    }
    setReady(true);
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    if (!email.trim() || !password.trim()) {
      return { ok: false, error: "Preencha e-mail e senha." };
    }

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: resolveLoginEmail(email),
        password,
      });
      if (error) {
        return { ok: false, error: "@ ou senha inválidos." };
      }
      // onAuthStateChange atualiza a sessão.
      return { ok: true };
    }

    // MOCK: qualquer credencial não-vazia entra.
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
    const supabase = getSupabase();
    if (supabase) {
      void supabase.auth.signOut();
      setSession(null);
      return;
    }
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

export { isSupabaseConfigured };
