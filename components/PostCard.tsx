"use client";

// Um post no feed, com todo o seu engajamento: reações e comentários. Cada card
// cuida do próprio estado — o feed só monta a lista. A identidade continua sendo
// o nome estelar; autoria e nome vêm do banco (selo), não do cliente.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { getSupabase } from "@/lib/supabase";
import { REACOES, emojiDe } from "@/lib/reacoes";
import Denunciar from "@/components/Denunciar";

export type Post = {
  id: string;
  author: string;
  author_name: string;
  scope: string;
  body: string;
  edited: boolean;
  created_at: string;
};

type Reacao = { pessoa: string; tipo: string };
type Comentario = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author: string;
  author_name: string;
  body: string;
  created_at: string;
};

function tempo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PostCard({
  post,
  meuId,
  meuNome,
  ehAdmin,
  onRemoved,
}: {
  post: Post;
  meuId: string | null;
  meuNome: string;
  ehAdmin: boolean;
  onRemoved: (id: string) => void;
}) {
  const [body, setBody] = useState(post.body);
  const [edited, setEdited] = useState(post.edited);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(post.body);

  const [reacoes, setReacoes] = useState<Reacao[]>([]);
  const [picker, setPicker] = useState(false);

  const [comentCount, setComentCount] = useState(0);
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [abertoComent, setAbertoComent] = useState(false);
  const [novoComent, setNovoComent] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  // Carrega reações e a contagem de comentários deste post.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    (async () => {
      const [r, c] = await Promise.all([
        supabase.from("post_reactions").select("pessoa, tipo").eq("post_id", post.id),
        supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
      ]);
      if (!ativo) return;
      setReacoes((r.data ?? []) as Reacao[]);
      setComentCount(c.count ?? 0);
    })();
    return () => {
      ativo = false;
    };
  }, [post.id]);

  const minhaReacao = reacoes.find((r) => r.pessoa === meuId)?.tipo ?? null;

  const reagir = async (tipo: string) => {
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    setPicker(false);
    if (minhaReacao === tipo) {
      // toca de novo no mesmo = remove
      setReacoes((prev) => prev.filter((r) => r.pessoa !== meuId));
      await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("pessoa", meuId);
      return;
    }
    setReacoes((prev) => [...prev.filter((r) => r.pessoa !== meuId), { pessoa: meuId, tipo }]);
    await supabase.from("post_reactions").upsert({ post_id: post.id, pessoa: meuId, tipo });
  };

  const abrirComentarios = useCallback(async () => {
    setAbertoComent((v) => !v);
    if (comentarios) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from("post_comments")
      .select("id, post_id, parent_id, author, author_name, body, created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComentarios((data ?? []) as Comentario[]);
  }, [comentarios, post.id]);

  const comentar = async (e: FormEvent) => {
    e.preventDefault();
    const texto = novoComent.trim();
    if (!texto) return;
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    setErro("");
    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: post.id,
        parent_id: respondendo,
        author: meuId,
        author_name: meuNome,
        body: texto,
      })
      .select("id, post_id, parent_id, author, author_name, body, created_at")
      .single();
    if (error) return setErro(error.message);
    setComentarios((prev) => [...(prev ?? []), data as Comentario]);
    setComentCount((n) => n + 1);
    setNovoComent("");
    setRespondendo(null);
  };

  const apagarComentario = async (id: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) return;
    setComentarios((prev) => (prev ?? []).filter((c) => c.id !== id && c.parent_id !== id));
    setComentCount((n) => Math.max(0, n - 1));
  };

  const salvarEdicao = async () => {
    const novo = rascunho.trim();
    if (!novo) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("posts").update({ body: novo }).eq("id", post.id);
    if (error) return setErro(error.message);
    setBody(novo);
    setEdited(true);
    setEditando(false);
  };

  const apagarPost = async () => {
    if (!window.confirm("Apagar este post?")) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return setErro(error.message);
    onRemoved(post.id);
  };

  const sou = post.author === meuId;
  const raizes = (comentarios ?? []).filter((c) => !c.parent_id);
  const respostasDe = (id: string) => (comentarios ?? []).filter((c) => c.parent_id === id);

  return (
    <article className="post">
      <header className="post-topo">
        <Link href={`/u/${post.author}`} className="post-autor">
          <span className="avatar">{(post.author_name ?? "??").slice(0, 2).toUpperCase()}</span>
          <span>
            <span className="nome">{post.author_name}</span>
            <span className="quando">
              {tempo(post.created_at)}
              {edited ? " · editado" : ""}
            </span>
          </span>
        </Link>
        {(sou || ehAdmin) && (
          <div className="row" style={{ gap: "0.3rem" }}>
            {sou && !editando && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setEditando(true);
                  setRascunho(body);
                }}
              >
                Editar
              </button>
            )}
            <button className="btn btn-sm btn-danger" onClick={apagarPost}>
              Apagar
            </button>
          </div>
        )}
      </header>

      {editando ? (
        <div className="stack" style={{ gap: "0.5rem" }}>
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={3}
            maxLength={5000}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div className="row" style={{ gap: "0.4rem" }}>
            <button className="btn btn-primary btn-sm" onClick={salvarEdicao}>
              Salvar
            </button>
            <button className="btn btn-sm" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="post-corpo">{body}</div>
      )}

      {erro && <div className="auth-error" style={{ marginTop: "0.5rem" }}>{erro}</div>}

      {/* barra de engajamento */}
      <div className="post-acoes">
        <div className="reacao-wrap">
          <button
            className={`btn btn-sm reacao-btn${minhaReacao ? " ativa" : ""}`}
            onClick={() => (minhaReacao ? reagir(minhaReacao) : setPicker((v) => !v))}
            onMouseEnter={() => setPicker(true)}
          >
            {minhaReacao ? `${emojiDe(minhaReacao)} Reagido` : "Reagir"}
          </button>
          {picker && (
            <div className="reacao-picker" onMouseLeave={() => setPicker(false)}>
              {REACOES.map((r) => (
                <button key={r.tipo} title={r.nome} onClick={() => reagir(r.tipo)}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-sm" onClick={abrirComentarios}>
          Comentar
        </button>

        {!sou && (
          <Denunciar
            alvoTipo="post"
            alvoId={post.id}
            alvoAutor={post.author}
            trecho={body}
            variante="botao"
          />
        )}

        <div className="post-contagem">
          {reacoes.length > 0 && (
            <span title={`${reacoes.length} reações`}>
              {[...new Set(reacoes.map((r) => r.tipo))].slice(0, 3).map((t) => (
                <span key={t}>{emojiDe(t)}</span>
              ))}{" "}
              {reacoes.length}
            </span>
          )}
          {comentCount > 0 && (
            <button className="link-contagem" onClick={abrirComentarios}>
              {comentCount} {comentCount === 1 ? "comentário" : "comentários"}
            </button>
          )}
        </div>
      </div>

      {/* comentários */}
      {abertoComent && (
        <div className="comentarios">
          {comentarios === null && <div className="muted">Carregando…</div>}
          {raizes.map((c) => (
            <div key={c.id} className="comentario">
              <Comentario
                c={c}
                meuId={meuId}
                ehAdmin={ehAdmin}
                onResponder={() => setRespondendo(c.id)}
                onApagar={() => apagarComentario(c.id)}
              />
              {respostasDe(c.id).map((r) => (
                <div key={r.id} className="comentario resposta">
                  <Comentario
                    c={r}
                    meuId={meuId}
                    ehAdmin={ehAdmin}
                    onApagar={() => apagarComentario(r.id)}
                  />
                </div>
              ))}
            </div>
          ))}

          <form className="comentar-form" onSubmit={comentar}>
            {respondendo && (
              <div className="muted respondendo-a">
                respondendo a um comentário{" "}
                <button type="button" onClick={() => setRespondendo(null)}>
                  cancelar
                </button>
              </div>
            )}
            <div className="row" style={{ gap: "0.4rem" }}>
              <input
                value={novoComent}
                onChange={(e) => setNovoComent(e.target.value)}
                placeholder="Escreva um comentário…"
                maxLength={2000}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!novoComent.trim()}>
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}

function Comentario({
  c,
  meuId,
  ehAdmin,
  onResponder,
  onApagar,
}: {
  c: Comentario;
  meuId: string | null;
  ehAdmin: boolean;
  onResponder?: () => void;
  onApagar: () => void;
}) {
  return (
    <div className="comentario-corpo">
      <div className="row between" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <Link href={`/u/${c.author}`} className="comentario-autor">
          {c.author_name}
        </Link>
        <span className="row" style={{ gap: "0.5rem" }}>
          {onResponder && (
            <button className="comentario-acao" onClick={onResponder}>
              responder
            </button>
          )}
          {(c.author === meuId || ehAdmin) && (
            <button className="comentario-acao" onClick={onApagar}>
              apagar
            </button>
          )}
          {c.author !== meuId && (
            <Denunciar
              alvoTipo="comentario"
              alvoId={c.id}
              alvoAutor={c.author}
              trecho={c.body}
              rotulo="denunciar"
            />
          )}
        </span>
      </div>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</div>
    </div>
  );
}
