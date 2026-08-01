"use client";

// Painel administrativo do wonderblue. Visível só para role='admin'. Reúne:
// candidaturas de entrada, pedidos de reset de senha, criação manual e a lista
// de usuários. Tudo pela API de servidor (service_role) — o navegador nunca toca
// na chave secreta.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
  role: string;
  instagram: string | null;
  age: number | null;
  profession: string | null;
  created_at: string;
};
type Application = {
  id: string;
  name: string;
  instagram: string;
  age: number | null;
  profession: string | null;
  status: string;
  created_at: string;
};
type PasswordRequest = {
  id: string;
  identifier: string;
  note: string | null;
  status: string;
  created_at: string;
};

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function igUrl(handle: string) {
  return `https://instagram.com/${(handle ?? "").replace(/^@+/, "")}`;
}

export default function AdminPage() {
  const { session, ready } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<PasswordRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ label: string; handle?: string; password: string } | null>(null);

  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [age, setAge] = useState("");
  const [profession, setProfession] = useState("");
  const [role, setRole] = useState("member");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (ready && session && session.role !== "admin") router.replace("/chat");
  }, [ready, session, router]);

  const load = useCallback(async () => {
    setError("");
    const headers = await authHeader();
    const [u, a, r] = await Promise.all([
      fetch("/api/admin/users", { headers }),
      fetch("/api/admin/applications", { headers }),
      fetch("/api/admin/password-requests", { headers }),
    ]);
    const uj = await u.json();
    if (!u.ok) {
      setError(uj.error ?? "Falha ao carregar.");
      setUsers([]);
    } else {
      setUsers(uj.users as UserRow[]);
    }
    if (a.ok) setApps(((await a.json()).applications as Application[]) ?? []);
    if (r.ok) setReqs(((await r.json()).requests as PasswordRequest[]) ?? []);
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
        body: JSON.stringify({ name, instagram, age, profession, role, password: password || undefined }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha ao criar usuário.");
      setCreated({ label: `@${json.handle}`, handle: json.handle, password: json.password });
      setName("");
      setInstagram("");
      setAge("");
      setProfession("");
      setRole("member");
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const reviewApp = async (app: Application, action: "approve" | "reject") => {
    if (action === "reject" && !window.confirm(`Recusar a candidatura de @${app.instagram}?`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha.");
      if (action === "approve")
        setCreated({ label: `@${json.handle}`, handle: json.handle, password: json.password });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resolveReq = async (req: PasswordRequest, action: "resolve" | "dismiss") => {
    if (action === "dismiss" && !window.confirm(`Descartar o pedido de @${req.identifier}?`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/password-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha.");
      if (action === "resolve")
        setCreated({ label: `@${json.handle}`, handle: json.handle, password: json.password });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (u: UserRow) => {
    if (!window.confirm(`Gerar nova senha para @${u.handle}?`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ action: "reset_password" }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha ao resetar senha.");
      setCreated({ label: `@${u.handle}`, handle: u.handle, password: json.password });
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: UserRow) => {
    if (!window.confirm(`Excluir @${u.handle}? Esta ação é irreversível.`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE", headers: await authHeader() });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha ao excluir.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !session || session.role !== "admin") return null;

  const total = users?.length ?? 0;
  const admins = users?.filter((r) => r.role === "admin").length ?? 0;
  const pendingApps = apps.filter((a) => a.status === "pending");
  const pendingReqs = reqs.filter((r) => r.status === "pending");

  return (
    <div className="stack">
      <div className="grid grid-stats">
        <div className="card stat">
          <div className="k">Usuários</div>
          <div className="v cyan num">{total}</div>
          <div className="d">{admins} admin(s)</div>
        </div>
        <div className="card stat">
          <div className="k">Candidaturas</div>
          <div className="v num">{pendingApps.length}</div>
          <div className="d">aguardando aprovação</div>
        </div>
        <div className="card stat">
          <div className="k">Pedidos de senha</div>
          <div className="v num">{pendingReqs.length}</div>
          <div className="d">aguardando reset</div>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="card">
          <div className="muted">Modo mock (sem Supabase). Gestão indisponível.</div>
        </div>
      )}
      {error && <div className="card auth-error">{error}</div>}

      {created && (
        <div className="card" style={{ borderColor: "var(--cyan, #35d0d0)" }}>
          <div className="card-title">Credenciais de {created.label} — envie por DM</div>
          <div className="muted">Não será exibida de novo. Repasse pelo direct do Instagram.</div>
          <pre style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap" }}>
{`login (@): ${created.handle ?? created.label}
senha:     ${created.password}`}
          </pre>
        </div>
      )}

      {/* candidaturas */}
      <div className="card">
        <div className="card-title">Candidaturas de entrada {pendingApps.length > 0 && `(${pendingApps.length})`}</div>
        {pendingApps.length === 0 && <div className="muted">Nenhuma candidatura pendente.</div>}
        <div className="stack" style={{ gap: "0.5rem" }}>
          {pendingApps.map((a) => (
            <div key={a.id} className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
              <div>
                <b>{a.name}</b>{" · "}
                <a href={igUrl(a.instagram)} target="_blank" rel="noreferrer">@{a.instagram}</a>
                <span className="muted">
                  {a.age ? ` · ${a.age} anos` : ""}
                  {a.profession ? ` · ${a.profession}` : ""}
                </span>
              </div>
              <div className="row" style={{ gap: "0.4rem" }}>
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => reviewApp(a, "approve")}>
                  Aprovar
                </button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => reviewApp(a, "reject")}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* pedidos de senha */}
      <div className="card">
        <div className="card-title">Pedidos de senha {pendingReqs.length > 0 && `(${pendingReqs.length})`}</div>
        {pendingReqs.length === 0 && <div className="muted">Nenhum pedido pendente.</div>}
        <div className="stack" style={{ gap: "0.5rem" }}>
          {pendingReqs.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
              <div>
                <a href={igUrl(r.identifier)} target="_blank" rel="noreferrer">@{r.identifier}</a>
                {r.note ? <span className="muted"> · “{r.note}”</span> : null}
              </div>
              <div className="row" style={{ gap: "0.4rem" }}>
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => resolveReq(r, "resolve")}>
                  Resetar e concluir
                </button>
                <button className="btn btn-sm" disabled={busy} onClick={() => resolveReq(r, "dismiss")}>
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* criar usuário */}
      <div className="card">
        <div className="card-title">Novo usuário</div>
        <form className="stack" onSubmit={createUser}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
            <div className="field">
              <label>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nome" />
            </div>
            <div className="field">
              <label>@ do Instagram</label>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@insta" />
            </div>
            <div className="field">
              <label>Idade</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="opcional" />
            </div>
            <div className="field">
              <label>Profissão</label>
              <input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="opcional" />
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
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="em branco = gerada" />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Processando..." : "Criar usuário"}
          </button>
        </form>
      </div>

      {/* lista */}
      <div className="card">
        <div className="card-title">Usuários cadastrados</div>
        {isSupabaseConfigured && !error && !users && <div className="muted">Carregando…</div>}
        {users && users.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-lo, #8a97a8)" }}>
                  <th style={{ padding: "0.5rem 0.6rem" }}>@ / login</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Nome</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Papel</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Desde</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      <a href={igUrl(u.instagram ?? u.handle)} target="_blank" rel="noreferrer">@{u.handle}</a>
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>{u.display_name}</td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      <span className="tag">{u.role}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem" }}>
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>
                      <div className="row" style={{ gap: "0.4rem", justifyContent: "flex-end" }}>
                        <button className="btn btn-sm" disabled={busy} onClick={() => resetPassword(u)}>
                          Resetar senha
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => removeUser(u)}>
                          Excluir
                        </button>
                      </div>
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
