"use client";

// Painel administrativo do wonderblue. Visível só para role='admin'. Reúne:
// candidaturas de entrada, pedidos de reset de senha, criação manual e a lista
// de usuários. Tudo pela API de servidor (service_role) — o navegador nunca toca
// na chave secreta.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";
import { SIGNOS, RELACIONAMENTOS, nomeDoSigno, sugerirNomeEstelar } from "@/lib/estelar";
import Tribos from "@/components/Tribos";

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
  real_name: string | null;
  sign: string | null;
  relationship: string | null;
  role: string;
  instagram: string | null;
  age: number | null;
  profession: string | null;
  city: string | null;
  created_at: string;
};
type Application = {
  id: string;
  name: string;
  instagram: string;
  sign: string | null;
  relationship: string | null;
  star_name: string | null;
  age: number | null;
  profession: string | null;
  city: string | null;
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

// O acesso é entregue no direct, na mão. Deixar a mensagem pronta evita o
// retrabalho de montar o texto a cada aprovação.
function mensagemDM(c: { handle?: string; password: string }): string {
  return [
    "Seu acesso ao wonderblue está pronto 🔵",
    "",
    `entrar com: ${c.handle ?? ""}`,
    `senha: ${c.password}`,
    "",
    "https://7aery.com",
    "",
    "Esta senha é provisória — ao entrar, você cria a sua.",
  ].join("\n");
}

export default function AdminPage() {
  const { session, ready } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<PasswordRequest[]>([]);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [batismo, setBatismo] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ label: string; handle?: string; password: string } | null>(null);

  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [age, setAge] = useState("");
  const [profession, setProfession] = useState("");
  const [role, setRole] = useState("member");
  const [password, setPassword] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [estelarNovo, setEstelarNovo] = useState("");
  const [signoNovo, setSignoNovo] = useState("");

  // edição inline de um usuário da lista
  const [editId, setEditId] = useState<string | null>(null);
  const [eNome, setENome] = useState("");
  const [eHandle, setEHandle] = useState("");
  const [eIdade, setEIdade] = useState("");
  const [eProf, setEProf] = useState("");
  const [eCidade, setECidade] = useState("");
  const [eReal, setEReal] = useState("");
  const [eSigno, setESigno] = useState("");
  const [eRelac, setERelac] = useState("");

  const abrirEdicao = (u: UserRow) => {
    setEditId(u.id);
    setENome(u.display_name ?? "");
    setEHandle(u.handle ?? "");
    setEIdade(u.age ? String(u.age) : "");
    setEProf(u.profession ?? "");
    setECidade(u.city ?? "");
    setEReal(u.real_name ?? "");
    setESigno(u.sign ?? "");
    setERelac(u.relationship ?? "");
    setError("");
  };

  const salvarEdicao = async (u: UserRow) => {
    const novoHandle = eHandle.trim().replace(/^@+/, "");
    // O @ é o login: só mexe se realmente mudou.
    if (novoHandle && novoHandle !== u.handle) {
      const r = await patchUser(u.id, { action: "set_handle", handle: novoHandle });
      if (!r) return;
    }
    const r2 = await patchUser(u.id, {
      action: "update_profile",
      display_name: eNome,
      age: eIdade,
      profession: eProf,
      city: eCidade,
      real_name: eReal,
      sign: eSigno,
      relationship: eRelac,
    });
    if (r2) setEditId(null);
  };

  useEffect(() => {
    if (ready && session && session.role !== "admin") router.replace("/chat");
  }, [ready, session, router]);

  // Guarda o próprio id para marcar "você" na lista.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setMeuId(data.session?.user.id ?? null));
  }, []);

  const load = useCallback(async () => {
    setError("");
    const headers = await authHeader();
    const [u, a, r, c] = await Promise.all([
      fetch("/api/admin/users", { headers }),
      fetch("/api/admin/applications", { headers }),
      fetch("/api/admin/password-requests", { headers }),
      fetch("/api/admin/chat", { headers }),
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
    if (c.ok) setChatCount(((await c.json()).count as number) ?? 0);
  }, []);

  // Ação genérica sobre um usuário (papel, @, perfil).
  const patchUser = async (id: string, body: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha na operação.");
        return null;
      }
      await load();
      return json;
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = async (u: UserRow) => {
    const alvo = u.role === "admin" ? "member" : "admin";
    const texto =
      alvo === "admin"
        ? `Tornar @${u.handle} administrador? Ganha todos os poderes do painel.`
        : `Remover o poder de administrador de @${u.handle}?`;
    if (!window.confirm(texto)) return;
    await patchUser(u.id, { action: "set_role", role: alvo });
  };

  const purgeChat = async (scope?: "history") => {
    const texto =
      scope === "history"
        ? "Apagar todo o histórico consolidado, preservando a janela em curso?"
        : "Apagar TODAS as mensagens do bate-papo? Esta ação é irreversível.";
    if (!window.confirm(texto)) return;
    setError("");
    setBusy(true);
    try {
      const url = scope ? `/api/admin/chat?scope=${scope}` : "/api/admin/chat";
      const res = await fetch(url, { method: "DELETE", headers: await authHeader() });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha ao limpar o bate-papo.");
      await load();
    } finally {
      setBusy(false);
    }
  };

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
        body: JSON.stringify({ name, star_name: estelarNovo, sign: signoNovo, instagram, age, profession, city: novaCidade, role, password: password || undefined }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error ?? "Falha ao criar usuário.");
      setCreated({ label: `@${json.handle}`, handle: json.handle, password: json.password });
      setName("");
      setInstagram("");
      setAge("");
      setProfession("");
      setNovaCidade("");
      setEstelarNovo("");
      setSignoNovo("");
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
        body: JSON.stringify({ action, star_name: batismo[app.id] ?? app.star_name ?? "" }),
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
        <div className="card destaque">
          <div className="card-title">Acesso de {created.label} — envie por DM</div>
          <div className="muted">
            A senha não será exibida de novo. Copie a mensagem pronta e cole no direct.
          </div>
          <pre style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap" }}>{mensagemDM(created)}</pre>
          <div className="row" style={{ gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={async () => {
                await navigator.clipboard.writeText(mensagemDM(created));
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
            >
              {copiado ? "Copiado ✓" : "Copiar mensagem"}
            </button>
            <a
              className="btn btn-sm"
              href={igUrl(created.handle ?? "")}
              target="_blank"
              rel="noreferrer"
            >
              Abrir o Instagram
            </a>
            <button className="btn btn-sm" onClick={() => setCreated(null)}>
              Já enviei
            </button>
          </div>
        </div>
      )}

      {/* candidaturas */}
      <div className="card">
        <div className="card-title">Candidaturas de entrada {pendingApps.length > 0 && `(${pendingApps.length})`}</div>
        {pendingApps.length === 0 && <div className="muted">Nenhuma candidatura pendente.</div>}
        <div className="stack" style={{ gap: "0.5rem" }}>
          {pendingApps.map((a) => (
            <div key={a.id} className="user-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  <b>{a.name}</b>{" · "}
                  <a href={igUrl(a.instagram)} target="_blank" rel="noreferrer" className="at-link">
                    @{a.instagram}
                  </a>
                </div>
                <div className="muted" style={{ fontSize: 13.5 }}>
                  {nomeDaCidade(a.city) ?? "sem cidade"}
                  {a.age ? ` · ${a.age} anos` : ""}
                  {a.profession ? ` · ${a.profession}` : ""}
                  {nomeDoSigno(a.sign) ? ` · ${nomeDoSigno(a.sign)}` : ""}
                </div>

                {/* batismo: sem nome estelar, ninguém entra */}
                <div className="row" style={{ gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    style={{ maxWidth: 200 }}
                    placeholder="nome estelar"
                    value={batismo[a.id] ?? a.star_name ?? ""}
                    onChange={(e) => setBatismo((b) => ({ ...b, [a.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      setBatismo((b) => ({
                        ...b,
                        [a.id]: sugerirNomeEstelar((users ?? []).map((x) => x.display_name)),
                      }))
                    }
                  >
                    Sortear
                  </button>
                </div>
              </div>

              <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={busy}
                  onClick={() => reviewApp(a, "approve")}
                >
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
          <div className="form-grid">
            <div className="field">
              <label>Nome estelar *</label>
              <div className="row" style={{ gap: "0.4rem" }}>
                <input
                  required
                  style={{ flex: 1, minWidth: 0 }}
                  value={estelarNovo}
                  onChange={(e) => setEstelarNovo(e.target.value)}
                  placeholder="Vega"
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setEstelarNovo(sugerirNomeEstelar((users ?? []).map((x) => x.display_name)))}
                >
                  Sortear
                </button>
              </div>
            </div>
            <div className="field">
              <label>Nome real *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="só você vê" />
            </div>
            <div className="field">
              <label>Signo *</label>
              <select required value={signoNovo} onChange={(e) => setSignoNovo(e.target.value)}>
                <option value="">Escolha o signo</option>
                {SIGNOS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.simbolo} {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>@ do Instagram</label>
              <input required value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@insta" />
            </div>
            <div className="field">
              <label>Cidade *</label>
              <select value={novaCidade} onChange={(e) => setNovaCidade(e.target.value)} required>
                <option value="">Escolha a cidade</option>
                {CIDADES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Idade *</label>
              <input type="number" required value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="field">
              <label>Profissão *</label>
              <input required value={profession} onChange={(e) => setProfession(e.target.value)} />
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

      <Tribos pessoas={(users ?? []).map((u) => ({ id: u.id, display_name: u.display_name }))} />

      {/* moderação do bate-papo */}
      <div className="card">
        <div className="card-title">Bate-papo</div>
        <div className="row between" style={{ flexWrap: "wrap", gap: "0.6rem" }}>
          <div className="muted">
            {chatCount === null
              ? "Carregando…"
              : `${chatCount} ${chatCount === 1 ? "mensagem guardada" : "mensagens guardadas"}.`}
          </div>
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => purgeChat("history")}>
              Limpar histórico
            </button>
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => purgeChat()}>
              Apagar tudo
            </button>
          </div>
        </div>
      </div>

      {/* lista de usuários — cartões, para caber no celular */}
      <div className="card">
        <div className="card-title">Usuários da rede</div>
        {isSupabaseConfigured && !error && !users && <div className="muted">Carregando…</div>}
        <div className="stack" style={{ gap: "0.6rem" }}>
          {users?.map((u) => (
            <div key={u.id} className="user-row">
              {editId === u.id ? (
                <div className="stack" style={{ gap: "0.7rem" }}>
                  <div className="form-grid">
                    <div className="field">
                      <label>Nome estelar</label>
                      <div className="row" style={{ gap: "0.4rem" }}>
                        <input
                          style={{ flex: 1, minWidth: 0 }}
                          value={eNome}
                          onChange={(e) => setENome(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            setENome(sugerirNomeEstelar((users ?? []).map((x) => x.display_name)))
                          }
                        >
                          Sortear
                        </button>
                      </div>
                      <span className="hint">É assim que a rede o conhece.</span>
                    </div>
                    <div className="field">
                      <label>Nome real</label>
                      <input value={eReal} onChange={(e) => setEReal(e.target.value)} />
                      <span className="hint">Só você vê.</span>
                    </div>
                    <div className="field">
                      <label>@ do Instagram (login)</label>
                      <input value={eHandle} onChange={(e) => setEHandle(e.target.value)} />
                      <span className="hint">Mudar o @ muda o login desta pessoa.</span>
                    </div>
                    <div className="field">
                      <label>Signo</label>
                      <select value={eSigno} onChange={(e) => setESigno(e.target.value)}>
                        <option value="">Sem signo</option>
                        {SIGNOS.map((s) => (
                          <option key={s.valor} value={s.valor}>
                            {s.simbolo} {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Momento</label>
                      <select value={eRelac} onChange={(e) => setERelac(e.target.value)}>
                        <option value="">Não informado</option>
                        {RELACIONAMENTOS.map((r) => (
                          <option key={r.valor} value={r.valor}>
                            {r.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Cidade</label>
                      <select value={eCidade} onChange={(e) => setECidade(e.target.value)}>
                        <option value="">Sem cidade</option>
                        {CIDADES.map((c) => (
                          <option key={c.valor} value={c.valor}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Idade</label>
                      <input type="number" value={eIdade} onChange={(e) => setEIdade(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Profissão</label>
                      <input value={eProf} onChange={(e) => setEProf(e.target.value)} />
                    </div>
                  </div>
                  <div className="row" style={{ gap: "0.4rem" }}>
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => salvarEdicao(u)}>
                      Salvar
                    </button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => setEditId(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                      <b>{u.display_name}</b>
                      {u.real_name && <span className="muted">({u.real_name})</span>}
                      <a href={igUrl(u.instagram ?? u.handle)} target="_blank" rel="noreferrer" className="at-link">
                        @{u.handle}
                      </a>
                      {u.role === "admin" && <span className="tag">admin</span>}
                      {u.id === meuId && <span className="tag">você</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {nomeDaCidade(u.city) ? `${nomeDaCidade(u.city)} · ` : ""}
                      {nomeDoSigno(u.sign) ? `${nomeDoSigno(u.sign)} · ` : ""}
                      {u.age ? `${u.age} anos · ` : ""}
                      {u.profession ? `${u.profession} · ` : ""}
                      desde {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                    <button className="btn btn-sm" disabled={busy} onClick={() => abrirEdicao(u)}>
                      Editar
                    </button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => resetPassword(u)}>
                      Senha
                    </button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => toggleRole(u)}>
                      {u.role === "admin" ? "Rebaixar" : "Promover"}
                    </button>
                    <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => removeUser(u)}>
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* histórico de decisões */}
      <div className="card">
        <button
          className="row between"
          onClick={() => setVerHistorico((v) => !v)}
          style={{ background: "none", border: "none", color: "inherit", width: "100%", cursor: "pointer", padding: 0 }}
        >
          <span className="card-title" style={{ margin: 0 }}>
            Histórico de decisões
          </span>
          <span className="muted">{verHistorico ? "▲" : "▼"}</span>
        </button>
        {verHistorico && (
          <div className="stack" style={{ marginTop: "0.9rem", gap: "0.5rem" }}>
            {apps.filter((a) => a.status !== "pending").length === 0 &&
              reqs.filter((r) => r.status !== "pending").length === 0 && (
                <div className="muted">Nada decidido ainda.</div>
              )}
            {apps
              .filter((a) => a.status !== "pending")
              .map((a) => (
                <div key={a.id} className="row between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  <span>
                    {a.name} · <a href={igUrl(a.instagram)} target="_blank" rel="noreferrer">@{a.instagram}</a>
                  </span>
                  <span className="muted">
                    {a.status === "approved" ? "aprovado" : "recusado"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            {reqs
              .filter((r) => r.status !== "pending")
              .map((r) => (
                <div key={r.id} className="row between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  <span>
                    senha · <a href={igUrl(r.identifier)} target="_blank" rel="noreferrer">@{r.identifier}</a>
                  </span>
                  <span className="muted">
                    resolvido · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
