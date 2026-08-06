"use client";

// Tribos: grupos dentro da rede. O administrador cria e coloca gente; pode
// nomear administradores da própria tribo, que passam a adicionar e remover sem
// depender dele. Cada tribo ganha uma sala de conversa.
import { useCallback, useEffect, useState, type FormEvent } from "react";

import Link from "next/link";

import { getSupabase } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";

type Tribo = { id: string; nome: string; descricao: string | null; city: string | null; permite_pedido: boolean };
type Membro = { tribo_id: string; pessoa: string; admin: boolean };
type Pessoa = { id: string; display_name: string };

export default function Tribos({ pessoas }: { pessoas: Pessoa[] }) {
  const [tribos, setTribos] = useState<Tribo[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cidade, setCidade] = useState("");
  const [permitePedido, setPermitePedido] = useState(true);
  const [aAdicionar, setAAdicionar] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [t, m] = await Promise.all([
      supabase.from("tribos").select("id, nome, descricao, city, permite_pedido").order("nome"),
      supabase.from("tribo_membros").select("tribo_id, pessoa, admin"),
    ]);
    setTribos((t.data ?? []) as Tribo[]);
    setMembros((m.data ?? []) as Membro[]);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomeDe = (id: string) => pessoas.find((p) => p.id === id)?.display_name ?? "membro";
  const daTribo = (id: string) => membros.filter((m) => m.tribo_id === id);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (nome.trim().length < 2) return setErro("Dê um nome à tribo.");
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      const { error } = await supabase.from("tribos").insert({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        city: cidade || null,
        permite_pedido: permitePedido,
      });
      if (error) return setErro(error.message);
      setNome("");
      setDescricao("");
      setCidade("");
      setPermitePedido(true);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const adicionar = async (triboId: string) => {
    const pessoa = aAdicionar[triboId];
    if (!pessoa) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setErro("");
    setOcupado(true);
    try {
      const { error } = await supabase.from("tribo_membros").insert({ tribo_id: triboId, pessoa });
      if (error) return setErro(error.message);
      setAAdicionar((a) => ({ ...a, [triboId]: "" }));
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const remover = async (triboId: string, pessoa: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      await supabase.from("tribo_membros").delete().eq("tribo_id", triboId).eq("pessoa", pessoa);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const alternarAdmin = async (triboId: string, pessoa: string, atual: boolean) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      await supabase
        .from("tribo_membros")
        .update({ admin: !atual })
        .eq("tribo_id", triboId)
        .eq("pessoa", pessoa);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const alternarPorta = async (t: Tribo) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      await supabase.from("tribos").update({ permite_pedido: !t.permite_pedido }).eq("id", t.id);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const apagar = async (t: Tribo) => {
    if (!window.confirm(`Apagar a tribo "${t.nome}"? A conversa dela some junto.`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      await supabase.from("tribos").delete().eq("id", t.id);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">Tribos</div>
      {erro && <div className="auth-error">{erro}</div>}

      <form className="stack" onSubmit={criar} style={{ marginBottom: "1rem" }}>
        <div className="form-grid">
          <div className="field">
            <label>Nome da tribo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Caminhada, Cinema…" />
          </div>
          <div className="field">
            <label>Cidade (opcional)</label>
            <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
              <option value="">Sem cidade fixa</option>
              {CIDADES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Descrição (opcional)</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="do que essa tribo trata"
          />
        </div>
        <label className="row" style={{ gap: "0.5rem", cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={permitePedido}
            onChange={(e) => setPermitePedido(e.target.checked)}
            style={{ width: "auto" }}
          />
          Aceita pedidos pra entrar (senão, só por convite)
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={ocupado}>
          Criar tribo
        </button>
      </form>

      {tribos.length === 0 && <div className="muted">Nenhuma tribo ainda.</div>}

      <div className="stack" style={{ gap: "0.6rem" }}>
        {tribos.map((t) => {
          const gente = daTribo(t.id);
          const aberto = aberta === t.id;
          return (
            <div key={t.id} className="user-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="row between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <b>{t.nome}</b>{" "}
                  <span className="muted">
                    {nomeDaCidade(t.city) ? `· ${nomeDaCidade(t.city)} ` : ""}· {gente.length}{" "}
                    {gente.length === 1 ? "pessoa" : "pessoas"}
                  </span>
                  {t.descricao && (
                    <div className="muted" style={{ fontSize: 13.5 }}>
                      {t.descricao}
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: "0.4rem" }}>
                  <Link href={`/tribos/${t.id}`} className="btn btn-sm">
                    Abrir
                  </Link>
                  <button className="btn btn-sm" onClick={() => setAberta(aberto ? null : t.id)}>
                    {aberto ? "Fechar" : "Gerenciar"}
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={ocupado} onClick={() => apagar(t)}>
                    Apagar
                  </button>
                </div>
              </div>

              {aberto && (
                <div className="stack" style={{ gap: "0.5rem", marginTop: "0.7rem" }}>
                  <div className="row between" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                    <span className="muted" style={{ fontSize: 13.5 }}>
                      Porta: {t.permite_pedido ? "aberta a pedidos" : "só por convite"}
                    </span>
                    <button className="btn btn-sm" disabled={ocupado} onClick={() => alternarPorta(t)}>
                      {t.permite_pedido ? "Fechar porta" : "Abrir porta"}
                    </button>
                  </div>
                  <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                    <select
                      value={aAdicionar[t.id] ?? ""}
                      onChange={(e) => setAAdicionar((a) => ({ ...a, [t.id]: e.target.value }))}
                      style={{ maxWidth: 240 }}
                    >
                      <option value="">Escolha quem entra</option>
                      {pessoas
                        .filter((p) => !gente.some((g) => g.pessoa === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.display_name}
                          </option>
                        ))}
                    </select>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={ocupado || !aAdicionar[t.id]}
                      onClick={() => adicionar(t.id)}
                    >
                      Adicionar
                    </button>
                  </div>

                  {gente.length === 0 && <div className="muted">Tribo vazia.</div>}
                  {gente.map((g) => (
                    <div key={g.pessoa} className="row between" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                      <span>
                        {nomeDe(g.pessoa)}
                        {g.admin && <span className="tag" style={{ marginLeft: "0.4rem" }}>admin da tribo</span>}
                      </span>
                      <div className="row" style={{ gap: "0.35rem" }}>
                        <button
                          className="btn btn-sm"
                          disabled={ocupado}
                          onClick={() => alternarAdmin(t.id, g.pessoa, g.admin)}
                        >
                          {g.admin ? "Tirar comando" : "Dar comando"}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={ocupado}
                          onClick={() => remover(t.id, g.pessoa)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
