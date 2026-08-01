"use client";

// Painel administrativo. Visível só para role = 'admin' (o item de menu já é
// condicional no AppShell, e aqui há a guarda de rota como segunda camada).
// Lista os perfis reais do Supabase; em modo mock mostra um aviso.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  role: string;
  reputation: number;
  created_at: string;
};

export default function AdminPage() {
  const { session, ready } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [error, setError] = useState("");
  const [mock, setMock] = useState(false);

  // Guarda de rota: quem não é admin volta para a Home.
  useEffect(() => {
    if (ready && session && session.role !== "admin") router.replace("/home");
  }, [ready, session, router]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setMock(true);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("id, handle, display_name, role, reputation, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setRows((data ?? []) as ProfileRow[]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!ready || !session || session.role !== "admin") return null;

  const total = rows?.length ?? 0;
  const admins = rows?.filter((r) => r.role === "admin").length ?? 0;
  const members = total - admins;

  return (
    <div className="stack">
      <div className="grid grid-stats">
        <div className="card stat">
          <div className="k">Usuários na rede</div>
          <div className="v cyan num">{total}</div>
          <div className="d">perfis cadastrados</div>
        </div>
        <div className="card stat">
          <div className="k">Administradores</div>
          <div className="v num">{admins}</div>
          <div className="d">acesso ao painel</div>
        </div>
        <div className="card stat">
          <div className="k">Membros</div>
          <div className="v num">{members}</div>
          <div className="d">navegação padrão</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Usuários</div>

        {mock && (
          <div className="muted">
            Backend em modo mock (sem <code>NEXT_PUBLIC_SUPABASE_*</code>). Conecte o Supabase
            para listar os usuários reais.
          </div>
        )}
        {error && <div className="auth-error">Erro ao carregar: {error}</div>}
        {!mock && !error && !rows && <div className="muted">Carregando…</div>}

        {rows && rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-lo, #8a97a8)" }}>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Handle</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Nome</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Papel</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Reputação</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Desde</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "0.5rem 0.6rem" }}>@{r.handle}</td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>{r.display_name}</td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      <span className="tag">{r.role}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>{r.reputation}</td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Como promover um administrador</div>
        <div className="muted">
          Por enquanto, o papel de admin é definido no banco. No SQL Editor do Supabase:
          <pre style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap" }}>
{`update public.profiles set role = 'admin'
where handle = 'handle_do_usuario';`}
          </pre>
        </div>
      </div>
    </div>
  );
}
