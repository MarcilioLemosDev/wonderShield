"use client";

// O mural de um escopo (Geral · cidade · tribo). Compositor + lista + realtime,
// num só lugar — o feed geral e a página da tribo usam o mesmo. A identidade é
// sempre o nome estelar; publicar só quando `podePublicar`.
import { useEffect, useState, type FormEvent } from "react";

import { getSupabase } from "@/lib/supabase";
import PostCard, { type Post } from "@/components/PostCard";

const CAMPOS = "id, author, author_name, scope, body, edited, created_at";

export default function FeedEscopo({
  scope,
  escopoNome,
  meuId,
  meuNome,
  ehAdmin,
  podePublicar = true,
}: {
  scope: string;
  escopoNome: string;
  meuId: string | null;
  meuNome: string;
  ehAdmin: boolean;
  podePublicar?: boolean;
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    setPosts(null);
    setErro("");

    supabase
      .from("posts")
      .select(CAMPOS)
      .eq("scope", scope)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        setPosts((data ?? []) as Post[]);
      });

    const canal = supabase
      .channel(`posts-${scope}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `scope=eq.${scope}` },
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
  }, [scope]);

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
        .insert({ author: meuId, author_name: meuNome, scope, body })
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

  const removerLocal = (id: string) => setPosts((prev) => (prev ?? []).filter((x) => x.id !== id));

  return (
    <div className="stack">
      {podePublicar && (
        <div className="card">
          <form onSubmit={publicar} className="stack" style={{ gap: "0.6rem" }}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={`Compartilhe algo em ${escopoNome}…`}
              style={{ width: "100%", resize: "vertical" }}
            />
            <div className="row between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <span className="muted" style={{ fontSize: 13 }}>
                publicando como <b style={{ color: "var(--ink-hi)" }}>{meuNome}</b>
              </span>
              <button className="btn btn-primary btn-sm" type="submit" disabled={enviando || !texto.trim()}>
                {enviando ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {erro && <div className="card auth-error">{erro}</div>}

      {!posts && <div className="card muted">Carregando…</div>}
      {posts && posts.length === 0 && (
        <div className="card muted">
          Nada em {escopoNome} ainda.{podePublicar ? " Seja o primeiro a publicar." : ""}
        </div>
      )}

      {posts?.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          meuId={meuId}
          meuNome={meuNome}
          ehAdmin={ehAdmin}
          onRemoved={removerLocal}
        />
      ))}
    </div>
  );
}
