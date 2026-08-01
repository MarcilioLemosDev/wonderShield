"use client";

// Painel administrativo. Visível só para role = 'admin' (item de menu condicional
// no AppShell + guarda de rota aqui). Lista, cria e exclui usuários chamando as
// rotas de servidor em /api/admin/users, que fazem o trabalho sensível com a
// service_role key — o navegador nunca toca nessa chave.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
  role: string;
  reputation: number;
  created_at: string;
  email: string;
};

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const { session, ready } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // formulário de criação
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("member");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  // Guarda de rota: quem não é admin volta para a Home.
  useEffect(() => {
    if (ready && session && session.role !== "admin") router.replace("/home");
  }, [ready, session, router]);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/admin/users", { headers: await authHeader() });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Falha ao carregar usuários.");
      setRows([]);
      return;
    }
    setRows(json.users as UserRow[]);
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) void load();
  }, [load]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCreated(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          email,
          display_name: displayName,
          role,
          password: password || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao criar usuário.");
        return;
      }
      setCreated({ email: json.email, password: json.password });
      setEmail("");
      setDisplayName("");
      setRole("member");
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: UserRow) => {
    if (!window.confirm(`Excluir o usuário ${u.email || u.handle}? Esta ação é irreversível.`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE",
        headers: await authHeader(),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao excluir usuário.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !session || session.role !== "admin") return null;

  const total = rows?.length ?? 0;
  const admins = rows?.filter((r) => r.role === "admin").length ?? 0;

  return (
    <div className="stack">
      <div className="grid grid-stats">
        <div className="card stat">
          <div className="k">Usuários</div>
          <div className="v cyan num">{total}</div>
          <div className="d">contas ativas</div>
        </div>
        <div className="card stat">
          <div className="k">Administradores</div>
          <div className="v num">{admins}</div>
          <div className="d">acesso ao painel</div>
        </div>
        <div className="card stat">
          <div className="k">Membros</div>
          <div className="v num">{total - admins}</div>
          <div className="d">navegação padrão</div>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="card">
          <div className="muted">
            Backend em modo mock (sem <code>NEXT_PUBLIC_SUPABASE_*</code>). Conecte o Supabase para
            gerenciar usuários.
          </div>
        </div>
      )}

      {error && <div className="card auth-error">{error}</div>}

      {/* criar usuário */}
      <div className="card">
        <div className="card-title">Novo usuário</div>
        <form className="stack" onSubmit={createUser}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
            <div className="field">
              <label>E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@exemplo.com"
              />
            </div>
            <div className="field">
              <label>Nome de exibição</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="field">
              <label>Papel</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="field">
              <label>Senha</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="deixe em branco para gerar automática"
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Processando..." : "Criar usuário"}
          </button>
        </form>

        {created && (
          <div className="card" style={{ marginTop: "0.9rem", borderColor: "var(--cyan, #35d0d0)" }}>
            <div className="card-title">Credenciais geradas — copie agora</div>
            <div className="muted">Esta senha não será exibida de novo. Envie ao usuário por um canal seguro.</div>
            <pre style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap" }}>
{`E-mail: ${created.email}
Senha:  ${created.password}`}
            </pre>
          </div>
        )}
      </div>

      {/* lista */}
      <div className="card">
        <div className="card-title">Usuários cadastrados</div>
        {isSupabaseConfigured && !error && !rows && <div className="muted">Carregando…</div>}
        {rows && rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-lo, #8a97a8)" }}>
                  <th style={{ padding: "0.5rem 0.6rem" }}>E-mail</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Handle</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Papel</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Desde</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "0.5rem 0.6rem" }}>{u.email || "—"}</td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>@{u.handle}</td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      <span className="tag">{u.role}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={() => removeUser(u)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
