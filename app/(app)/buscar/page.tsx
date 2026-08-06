"use client";

// Busca global. Um campo, três frentes: pessoas (nome estelar), tribos e posts.
// Tudo respeita a RLS — não aparece quem está oculto/suspenso, nem post de tribo
// de quem não é de lá. Sem @ nem nome real, como manda a casa.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { nomeDaCidade } from "@/lib/cidades";
import { nomeDoSigno } from "@/lib/estelar";
import Avatar from "@/components/Avatar";

type Pessoa = { id: string; display_name: string; sign: string | null; city: string | null };
type Tribo = { id: string; nome: string; city: string | null };
type Post = { id: string; author: string; author_name: string; scope: string; body: string; created_at: string };

function escaparIlike(s: string): string {
  return s.replace(/[%_,]/g, (m) => `\\${m}`);
}

function nomeDoEscopo(scope: string): string {
  if (scope === "oficial") return "mural oficial";
  if (scope === "geral") return "geral";
  if (scope.startsWith("tribo:")) return "tribo";
  return nomeDaCidade(scope) ?? "cidade";
}

export default function BuscarPage() {
  const [q, setQ] = useState("");
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [tribos, setTribos] = useState<Tribo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [feito, setFeito] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) {
      setPessoas([]);
      setTribos([]);
      setPosts([]);
      setFeito(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const like = `%${escaparIlike(termo)}%`;
      const [p, tr, po] = await Promise.all([
        supabase.from("profiles").select("id, display_name, sign, city").ilike("display_name", like).limit(12),
        supabase.from("tribos").select("id, nome, city").ilike("nome", like).limit(12),
        supabase
          .from("posts")
          .select("id, author, author_name, scope, body, created_at")
          .ilike("body", like)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
      if (!ativo) return;
      setPessoas((p.data ?? []) as Pessoa[]);
      setTribos((tr.data ?? []) as Tribo[]);
      setPosts((po.data ?? []) as Post[]);
      setBuscando(false);
      setFeito(true);
    }, 260);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [q]);

  if (!isSupabaseConfigured) return <div className="card muted">Busca indisponível em modo mock.</div>;

  const vazio = feito && !buscando && pessoas.length === 0 && tribos.length === 0 && posts.length === 0;

  return (
    <div className="stack">
      <div className="card">
        <input
          ref={campoRef}
          className="busca"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pessoas, tribos, posts…"
        />
        <div className="muted" style={{ fontSize: 13, marginTop: "0.5rem" }}>
          Só nome estelar — nada de @ ou nome de verdade. Isso é do encontro.
        </div>
      </div>

      {q.trim().length >= 2 && vazio && <div className="card muted">Nada encontrado para “{q.trim()}”.</div>}

      {pessoas.length > 0 && (
        <div className="card">
          <div className="card-title">Pessoas</div>
          <div className="stack" style={{ gap: "0.4rem" }}>
            {pessoas.map((p) => (
              <Link key={p.id} href={`/u/${p.id}`} className="pessoa">
                <Avatar nome={p.display_name} seed={p.id} sign={p.sign} />
                <span style={{ minWidth: 0 }}>
                  <span className="nome">{p.display_name}</span>
                  <span className="sub">
                    {nomeDoSigno(p.sign) ? `${nomeDoSigno(p.sign)} · ` : ""}
                    {nomeDaCidade(p.city) ?? "sem cidade"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tribos.length > 0 && (
        <div className="card">
          <div className="card-title">Tribos</div>
          <div className="stack" style={{ gap: "0.4rem" }}>
            {tribos.map((t) => (
              <Link key={t.id} href={`/tribos/${t.id}`} className="pessoa">
                <span className="avatar" style={{ background: "linear-gradient(140deg, var(--cyan), var(--blue))" }}>
                  {t.nome.slice(0, 2).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="nome">{t.nome}</span>
                  <span className="sub">{nomeDaCidade(t.city) ?? "sem cidade fixa"}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="card">
          <div className="card-title">Posts</div>
          <div className="stack" style={{ gap: "0.6rem" }}>
            {posts.map((p) => (
              <div key={p.id} className="busca-post">
                <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <Link href={`/u/${p.author}`} className="msg-author">
                    {p.author_name}
                  </Link>
                  <span className="tag">{nomeDoEscopo(p.scope)}</span>
                </div>
                <div className="busca-trecho">{p.body.slice(0, 220)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
