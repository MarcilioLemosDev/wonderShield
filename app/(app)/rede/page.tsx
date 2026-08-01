"use client";

// Rede: quem está aqui, filtrado por cidade. É a porta para o encontro — por
// isso a cidade manda. Aberta a todos os membros.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";

type Pessoa = {
  id: string;
  handle: string;
  display_name: string;
  instagram: string | null;
  profession: string | null;
  city: string | null;
};

export default function RedePage() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [cidade, setCidade] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;

    const carregar = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name, instagram, profession, city")
        .order("display_name", { ascending: true });
      if (ativo) setPessoas((data ?? []) as Pessoa[]);
    };
    void carregar();

    // Reflete na hora: alguém definiu a cidade, entrou ou saiu da rede.
    const canal = supabase
      .channel("rede-perfis")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void carregar();
      })
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (pessoas ?? []).filter((p) => {
      if (cidade !== "todas" && p.city !== cidade) return false;
      if (!termo) return true;
      return (
        p.display_name?.toLowerCase().includes(termo) ||
        p.handle?.toLowerCase().includes(termo) ||
        (p.profession ?? "").toLowerCase().includes(termo)
      );
    });
  }, [pessoas, cidade, busca]);

  // Quantas pessoas por cidade, para mostrar no filtro.
  const contagem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pessoas ?? []) {
      if (p.city) mapa.set(p.city, (mapa.get(p.city) ?? 0) + 1);
    }
    return mapa;
  }, [pessoas]);

  if (!isSupabaseConfigured) {
    return (
      <div className="card">
        <div className="muted">Rede indisponível em modo mock.</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="filtros">
          <button
            className={`chip${cidade === "todas" ? " ativo" : ""}`}
            onClick={() => setCidade("todas")}
          >
            Todas <span className="qtd">{pessoas?.length ?? 0}</span>
          </button>
          {CIDADES.map((c) => (
            <button
              key={c.valor}
              className={`chip${cidade === c.valor ? " ativo" : ""}`}
              onClick={() => setCidade(c.valor)}
            >
              {c.nome} <span className="qtd">{contagem.get(c.valor) ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          className="busca"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, @ ou profissão…"
        />
      </div>

      <div className="card">
        <div className="card-title">
          {cidade === "todas" ? "Todo mundo" : nomeDaCidade(cidade)}
          <span className="muted" style={{ fontWeight: 400 }}>
            {" "}
            · {lista.length} {lista.length === 1 ? "pessoa" : "pessoas"}
          </span>
        </div>

        {!pessoas && <div className="muted">Carregando…</div>}
        {pessoas && lista.length === 0 && (
          <div className="muted">
            {cidade === "todas"
              ? "Ninguém por aqui ainda."
              : `Ninguém em ${nomeDaCidade(cidade)} ainda. Seja o primeiro — defina sua cidade no perfil.`}
          </div>
        )}

        <div className="pessoas">
          {lista.map((p) => (
            <Link key={p.id} href={`/u/${p.id}`} className="pessoa">
              <span className="avatar">
                {(p.display_name ?? "??").slice(0, 2).toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="nome">{p.display_name}</span>
                <span className="sub">
                  @{p.handle}
                  {p.profession ? ` · ${p.profession}` : ""}
                  {nomeDaCidade(p.city) ? ` · ${nomeDaCidade(p.city)}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
