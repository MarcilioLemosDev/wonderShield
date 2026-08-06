"use client";

// Feed. O mural permanente da rede — o contraponto ao chat efêmero de 12h. Um
// post fica. O escopo é o mesmo do bate-papo (Geral · cidade · tribo), para o
// feed herdar a estrutura que a rede já conhece. A identidade é o nome estelar.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";

type Post = {
  id: string;
  author: string;
  author_name: string;
  scope: string;
  body: string;
  edited: boolean;
  created_at: string;
};

const CAMPOS = "id, author, author_name, scope, body, edited, created_at";

// "agora", "há 3 min", "há 2 h", "ontem", "12/08"
function tempo(iso: string): string {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function nomeDoEscopo(scope: string, tribos: { id: string; nome: string }[]): string {
  if (scope === "geral") return "Rede toda";
  if (scope.startsWith("tribo:")) {
    return tribos.find((t) => t.id === scope.slice(6))?.nome ?? "Tribo";
  }
  return nomeDaCidade(scope) ?? "Cidade";
}

export default function FeedPage() {
  const { session } = useAuth();
  const [meuId, setMeuId] = useState<string | null>(null);
  const [minhaCidade, setMinhaCidade] = useState<string>("");
  const [tribos, setTribos] = useState<{ id: string; nome: string }[]>([]);
  const [escopo, setEscopo] = useState<string>("geral");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Quem sou, minha cidade e minhas tribos — para montar os escopos possíveis.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;
      if (!ativo) return;
      setMeuId(uid);
      if (!uid) return;
      const [perfil, minhasTribos] = await Promise.all([
        supabase.from("profiles").select("city").eq("id", uid).single(),
        supabase.from("tribo_membros").select("tribos(id, nome)").eq("pessoa", uid),
      ]);
      if (!ativo) return;
      if (perfil.data?.city) setMinhaCidade(perfil.data.city);
      const lista = ((minhasTribos.data ?? []) as unknown as {
        tribos: { id: string; nome: string } | { id: string; nome: string }[] | null;
      }[])
        .flatMap((t) => (Array.isArray(t.tribos) ? t.tribos : t.tribos ? [t.tribos] : []))
        .filter((t) => !!t?.id);
      setTribos(lista);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // Carrega o feed do escopo aberto + realtime.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    setPosts(null);
    setErro("");

    supabase
      .from("posts")
      .select(CAMPOS)
      .eq("scope", escopo)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        setPosts((data ?? []) as Post[]);
      });

    const canal = supabase
      .channel(`posts-${escopo}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `scope=eq.${escopo}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPosts((prev) => {
              const p = payload.new as Post;
              return prev && prev.some((x) => x.id === p.id) ? prev : [p, ...(prev ?? [])];
            });
          } else if (payload.eventType === "DELETE") {
            setPosts((prev) => (prev ?? []).filter((x) => x.id !== (payload.old as Post).id));
          } else if (payload.eventType === "UPDATE") {
            setPosts((prev) =>
              (prev ?? []).map((x) => (x.id === (payload.new as Post).id ? (payload.new as Post) : x)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [escopo]);

  const escopos = useMemo(() => {
    const base = [{ valor: "geral", nome: "Geral" }];
    if (minhaCidade) base.push({ valor: minhaCidade, nome: nomeDaCidade(minhaCidade) ?? "Cidade" });
    // além da minha cidade, deixo escolher qualquer cidade da rede
    for (const c of CIDADES) if (c.valor !== minhaCidade) base.push({ valor: c.valor, nome: c.nome });
    for (const t of tribos) base.push({ valor: `tribo:${t.id}`, nome: t.nome });
    return base;
  }, [minhaCidade, tribos]);

  const publicar = async (e: FormEvent) => {
    e.preventDefault();
    const body = texto.trim();
    if (!body) return;
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    setErro("");
    setEnviando(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .insert({ author: meuId, author_name: session?.displayName ?? "membro", scope: escopo, body })
        .select(CAMPOS)
        .single();
      if (error) {
        setErro(error.message);
        return;
      }
      setTexto("");
      if (data) setPosts((prev) => (prev ? [data as Post, ...prev] : [data as Post]));
    } finally {
      setEnviando(false);
    }
  };

  const salvarEdicao = async (p: Post) => {
    const body = textoEdit.trim();
    if (!body) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("posts").update({ body }).eq("id", p.id);
    if (error) return setErro(error.message);
    setPosts((prev) => (prev ?? []).map((x) => (x.id === p.id ? { ...x, body, edited: true } : x)));
    setEditando(null);
  };

  const apagar = async (p: Post) => {
    if (!window.confirm("Apagar este post?")) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("posts").delete().eq("id", p.id);
    if (error) return setErro(error.message);
    setPosts((prev) => (prev ?? []).filter((x) => x.id !== p.id));
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="card">
        <div className="muted">Feed indisponível em modo mock.</div>
      </div>
    );
  }

  const ehAdmin = session?.role === "admin";

  return (
    <div className="stack">
      {/* escopo */}
      <div className="card">
        <div className="filtros">
          {escopos.map((s) => (
            <button
              key={s.valor}
              className={`chip${escopo === s.valor ? " ativo" : ""}${s.valor.startsWith("tribo:") ? " tribo" : ""}`}
              onClick={() => setEscopo(s.valor)}
            >
              {s.nome}
            </button>
          ))}
        </div>

        {/* compositor */}
        <form onSubmit={publicar} className="stack" style={{ gap: "0.6rem" }}>
          <textarea
            ref={composerRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={`Compartilhe algo em ${nomeDoEscopo(escopo, tribos)}…`}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div className="row between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <span className="muted" style={{ fontSize: 13 }}>
              publicando como <b style={{ color: "var(--ink-hi)" }}>{session?.displayName}</b>
            </span>
            <button className="btn btn-primary btn-sm" type="submit" disabled={enviando || !texto.trim()}>
              {enviando ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </form>
      </div>

      {erro && <div className="card auth-error">{erro}</div>}

      {/* feed */}
      {!posts && <div className="card muted">Carregando…</div>}
      {posts && posts.length === 0 && (
        <div className="card muted">
          Nada em {nomeDoEscopo(escopo, tribos)} ainda. Seja o primeiro a publicar.
        </div>
      )}

      {posts?.map((p) => (
        <article key={p.id} className="post">
          <header className="post-topo">
            <Link href={`/u/${p.author}`} className="post-autor">
              <span className="avatar">{(p.author_name ?? "??").slice(0, 2).toUpperCase()}</span>
              <span>
                <span className="nome">{p.author_name}</span>
                <span className="quando">
                  {tempo(p.created_at)}
                  {p.edited ? " · editado" : ""}
                </span>
              </span>
            </Link>
            {(p.author === meuId || ehAdmin) && (
              <div className="row" style={{ gap: "0.3rem" }}>
                {p.author === meuId && editando !== p.id && (
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setEditando(p.id);
                      setTextoEdit(p.body);
                    }}
                  >
                    Editar
                  </button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => apagar(p)}>
                  Apagar
                </button>
              </div>
            )}
          </header>

          {editando === p.id ? (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <textarea
                value={textoEdit}
                onChange={(e) => setTextoEdit(e.target.value)}
                rows={3}
                maxLength={5000}
                style={{ width: "100%", resize: "vertical" }}
              />
              <div className="row" style={{ gap: "0.4rem" }}>
                <button className="btn btn-primary btn-sm" onClick={() => salvarEdicao(p)}>
                  Salvar
                </button>
                <button className="btn btn-sm" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="post-corpo">{p.body}</div>
          )}
        </article>
      ))}
    </div>
  );
}
