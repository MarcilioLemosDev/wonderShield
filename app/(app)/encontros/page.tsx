"use client";

// Encontros. É aqui que a conversa vira data, hora e endereço — a razão de a
// rede existir. Alguém propõe, os outros confirmam presença.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";

type Encontro = {
  id: string;
  autor: string;
  titulo: string;
  local: string;
  detalhes: string | null;
  quando: string;
  city: string;
  cancelado: boolean;
};

type Presenca = { encontro_id: string; pessoa: string };

// "quinta, 14 de agosto às 20h30"
function quandoLegivel(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

function ehPassado(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default function EncontrosPage() {
  const { session } = useAuth();
  const [encontros, setEncontros] = useState<Encontro[] | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [minhaCidade, setMinhaCidade] = useState<string>("");
  const [cidade, setCidade] = useState<string>("todas");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [propondo, setPropondo] = useState(false);

  // formulário
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [quando, setQuando] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [cidadeNova, setCidadeNova] = useState("");

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [e, p] = await Promise.all([
      supabase
        .from("encontros")
        .select("id, autor, titulo, local, detalhes, quando, city, cancelado")
        .order("quando", { ascending: true }),
      supabase.from("presencas").select("encontro_id, pessoa"),
    ]);
    setEncontros((e.data ?? []) as Encontro[]);
    setPresencas((p.data ?? []) as Presenca[]);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;
      if (!ativo) return;
      setMeuId(uid);
      if (uid) {
        const { data } = await supabase.from("profiles").select("city").eq("id", uid).single();
        if (ativo && data?.city) {
          setMinhaCidade(data.city);
          setCidade(data.city);
          setCidadeNova(data.city);
        }
      }
      await carregar();
    })();

    // Alguém propôs ou confirmou: a lista reflete na hora.
    const canal = supabase
      .channel("encontros-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "encontros" }, () => {
        void carregar();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "presencas" }, () => {
        void carregar();
      })
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const proximos = useMemo(() => {
    return (encontros ?? [])
      .filter((e) => !ehPassado(e.quando) && !e.cancelado)
      .filter((e) => cidade === "todas" || e.city === cidade);
  }, [encontros, cidade]);

  const passados = useMemo(() => {
    return (encontros ?? [])
      .filter((e) => ehPassado(e.quando) || e.cancelado)
      .filter((e) => cidade === "todas" || e.city === cidade)
      .sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())
      .slice(0, 20);
  }, [encontros, cidade]);

  const vou = (id: string) => presencas.some((p) => p.encontro_id === id && p.pessoa === meuId);
  const quantos = (id: string) => presencas.filter((p) => p.encontro_id === id).length;

  const alternarPresenca = async (e: Encontro) => {
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    setErro("");
    setOcupado(true);
    try {
      if (vou(e.id)) {
        const { error } = await supabase
          .from("presencas")
          .delete()
          .eq("encontro_id", e.id)
          .eq("pessoa", meuId);
        if (error) return setErro(error.message);
      } else {
        const { error } = await supabase
          .from("presencas")
          .insert({ encontro_id: e.id, pessoa: meuId });
        if (error) return setErro(error.message);
      }
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const propor = async (ev: FormEvent) => {
    ev.preventDefault();
    setErro("");
    const supabase = getSupabase();
    if (!supabase || !meuId) return;

    if (titulo.trim().length < 3) return setErro("Dê um nome ao encontro.");
    if (local.trim().length < 3) return setErro("Informe onde vai ser.");
    if (!quando) return setErro("Informe quando vai ser.");
    if (new Date(quando).getTime() < Date.now()) return setErro("Escolha uma data à frente.");
    if (!cidadeNova) return setErro("Escolha a cidade.");

    setOcupado(true);
    try {
      const { data, error } = await supabase
        .from("encontros")
        .insert({
          autor: meuId,
          titulo: titulo.trim(),
          local: local.trim(),
          detalhes: detalhes.trim() || null,
          quando: new Date(quando).toISOString(),
          city: cidadeNova,
        })
        .select("id")
        .single();
      if (error) return setErro(error.message);

      // quem propõe já está confirmado
      if (data) await supabase.from("presencas").insert({ encontro_id: data.id, pessoa: meuId });

      setTitulo("");
      setLocal("");
      setQuando("");
      setDetalhes("");
      setCidadeNova(minhaCidade);
      setPropondo(false);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = async (e: Encontro) => {
    if (!window.confirm(`Cancelar "${e.titulo}"? Quem confirmou vai ver que não acontece mais.`))
      return;
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      const { error } = await supabase.from("encontros").update({ cancelado: true }).eq("id", e.id);
      if (error) setErro(error.message);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="card">
        <div className="muted">Encontros indisponíveis em modo mock.</div>
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
            Todas
          </button>
          {CIDADES.map((c) => (
            <button
              key={c.valor}
              className={`chip${cidade === c.valor ? " ativo" : ""}`}
              onClick={() => setCidade(c.valor)}
            >
              {c.nome}
            </button>
          ))}
        </div>

        {!propondo ? (
          <button className="btn btn-primary" onClick={() => setPropondo(true)}>
            Propor encontro
          </button>
        ) : (
          <form className="stack" onSubmit={propor}>
            <div className="field">
              <label>O que é</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="café da manhã, caminhada no parque, cerveja depois do trabalho…"
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Onde</label>
                <input
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="nome do lugar e endereço"
                />
              </div>
              <div className="field">
                <label>Quando</label>
                <input
                  type="datetime-local"
                  value={quando}
                  onChange={(e) => setQuando(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Cidade</label>
                <select value={cidadeNova} onChange={(e) => setCidadeNova(e.target.value)}>
                  <option value="">Escolha a cidade</option>
                  {CIDADES.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Detalhes (opcional)</label>
              <textarea
                rows={3}
                maxLength={1000}
                value={detalhes}
                onChange={(e) => setDetalhes(e.target.value)}
                placeholder="algo que ajude quem vai: ponto de referência, o que levar…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            {erro && <div className="auth-error">{erro}</div>}
            <div className="row" style={{ gap: "0.5rem" }}>
              <button className="btn btn-primary" type="submit" disabled={ocupado}>
                {ocupado ? "Marcando..." : "Marcar encontro"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setPropondo(false);
                  setErro("");
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {erro && !propondo && <div className="card auth-error">{erro}</div>}

      <div className="card">
        <div className="card-title">
          Próximos
          <span className="muted" style={{ fontWeight: 400 }}>
            {" "}
            · {proximos.length}
          </span>
        </div>

        {!encontros && <div className="muted">Carregando…</div>}
        {encontros && proximos.length === 0 && (
          <div className="muted">
            Nada marcado{cidade === "todas" ? "" : ` em ${nomeDaCidade(cidade)}`} ainda. Proponha o
            primeiro — é para isso que a rede existe.
          </div>
        )}

        <div className="stack" style={{ gap: "0.6rem" }}>
          {proximos.map((e) => (
            <div key={e.id} className="encontro">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="titulo">{e.titulo}</div>
                <div className="quando">{quandoLegivel(e.quando)}</div>
                <div className="muted" style={{ fontSize: 13.5 }}>
                  {e.local} · {nomeDaCidade(e.city)}
                </div>
                {e.detalhes && (
                  <div className="muted" style={{ fontSize: 13.5, marginTop: "0.3rem" }}>
                    {e.detalhes}
                  </div>
                )}
                <div className="muted" style={{ fontSize: 13, marginTop: "0.35rem" }}>
                  {quantos(e.id)} {quantos(e.id) === 1 ? "confirmado" : "confirmados"} ·{" "}
                  <Link href={`/u/${e.autor}`} className="msg-author">
                    proposto por {e.autor === meuId ? "você" : "um membro"}
                  </Link>
                </div>
              </div>
              <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  className={`btn btn-sm${vou(e.id) ? "" : " btn-primary"}`}
                  disabled={ocupado}
                  onClick={() => alternarPresenca(e)}
                >
                  {vou(e.id) ? "Não vou mais" : "Eu vou"}
                </button>
                {(e.autor === meuId || session?.role === "admin") && (
                  <button className="btn btn-sm btn-danger" disabled={ocupado} onClick={() => cancelar(e)}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {passados.length > 0 && (
        <div className="card">
          <div className="card-title">Já aconteceram</div>
          <div className="stack" style={{ gap: "0.4rem" }}>
            {passados.map((e) => (
              <div key={e.id} className="row between" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                <span className="muted">
                  {e.cancelado ? "cancelado · " : ""}
                  {e.titulo} · {nomeDaCidade(e.city)}
                </span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {new Date(e.quando).toLocaleDateString("pt-BR")} · {quantos(e.id)} foram
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
