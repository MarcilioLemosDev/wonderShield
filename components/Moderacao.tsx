"use client";

// A fila da moderação. Só a administração vê. Cada denúncia traz o trecho do
// conteúdo, quem sinalizou e de quem é o alvo. Daqui se resolve, se descarta —
// ou se bane o autor do alvo. O banimento passa pela API de servidor (a coluna
// é congelada para o navegador); resolver/descartar vai direto pela RLS de admin.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getSupabase } from "@/lib/supabase";

type Denuncia = {
  id: string;
  denunciante: string;
  alvo_tipo: "post" | "comentario" | "mensagem" | "perfil";
  alvo_id: string | null;
  alvo_autor: string | null;
  trecho: string | null;
  motivo: string | null;
  status: "aberta" | "resolvida" | "descartada";
  created_at: string;
};

type Pessoa = { id: string; display_name: string; banned?: boolean };

const ROTULO_TIPO: Record<Denuncia["alvo_tipo"], string> = {
  post: "post",
  comentario: "comentário",
  mensagem: "mensagem",
  perfil: "perfil",
};

export default function Moderacao({
  pessoas,
  onBanir,
}: {
  pessoas: Pessoa[];
  onBanir: (id: string, banir: boolean) => Promise<void>;
}) {
  const [itens, setItens] = useState<Denuncia[]>([]);
  const [verHistorico, setVerHistorico] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);

  const nomeDe = (id: string | null) =>
    (id && pessoas.find((p) => p.id === id)?.display_name) || "membro";
  const banido = (id: string | null) => !!id && !!pessoas.find((p) => p.id === id)?.banned;

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getSession();
    setMeuId(sess.session?.user.id ?? null);
    const { data } = await supabase
      .from("denuncias")
      .select("id, denunciante, alvo_tipo, alvo_id, alvo_autor, trecho, motivo, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setItens((data ?? []) as Denuncia[]);
  }, []);

  useEffect(() => {
    void carregar();
    const supabase = getSupabase();
    if (!supabase) return;
    const canal = supabase
      .channel("moderacao-denuncias")
      .on("postgres_changes", { event: "*", schema: "public", table: "denuncias" }, () => {
        void carregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const decidir = async (d: Denuncia, status: "resolvida" | "descartada") => {
    const supabase = getSupabase();
    if (!supabase) return;
    setOcupado(true);
    try {
      await supabase
        .from("denuncias")
        .update({ status, resolved_at: new Date().toISOString(), resolved_by: meuId })
        .eq("id", d.id);
      setItens((prev) => prev.map((x) => (x.id === d.id ? { ...x, status } : x)));
    } finally {
      setOcupado(false);
    }
  };

  const banir = async (d: Denuncia) => {
    if (!d.alvo_autor) return;
    const jaBanido = banido(d.alvo_autor);
    const nome = nomeDe(d.alvo_autor);
    const texto = jaBanido
      ? `Readmitir ${nome} na rede?`
      : `Suspender ${nome}? A conta some da vista dos outros e não escreve mais em lugar nenhum.`;
    if (!window.confirm(texto)) return;
    setOcupado(true);
    try {
      await onBanir(d.alvo_autor, !jaBanido);
      // ao suspender a partir de uma denúncia, dá pra considerá-la resolvida
      if (!jaBanido && d.status === "aberta") await decidir(d, "resolvida");
    } finally {
      setOcupado(false);
    }
  };

  const abertas = itens.filter((d) => d.status === "aberta");
  const fechadas = itens.filter((d) => d.status !== "aberta");

  const linha = (d: Denuncia) => (
    <div key={d.id} className="user-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
      <div className="row between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ minWidth: 0 }}>
          <span className="tag">{ROTULO_TIPO[d.alvo_tipo]}</span>{" "}
          {d.alvo_autor ? (
            <>
              de{" "}
              <Link href={`/u/${d.alvo_autor}`} className="msg-author">
                {nomeDe(d.alvo_autor)}
              </Link>
              {banido(d.alvo_autor) && <span className="tag banido" style={{ marginLeft: "0.4rem" }}>suspenso</span>}
            </>
          ) : (
            <span className="muted">alvo sem autor</span>
          )}
          <div className="muted" style={{ fontSize: 12.5 }}>
            sinalizado por {nomeDe(d.denunciante)} · {new Date(d.created_at).toLocaleDateString("pt-BR")}
            {d.status !== "aberta" ? ` · ${d.status}` : ""}
          </div>
        </div>
      </div>

      {d.trecho && <div className="comentario-corpo" style={{ fontSize: 13.5 }}>{d.trecho}</div>}
      {d.motivo && <div className="muted" style={{ fontSize: 13.5 }}>motivo: “{d.motivo}”</div>}

      {d.status === "aberta" && (
        <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-primary" disabled={ocupado} onClick={() => decidir(d, "resolvida")}>
            Resolver
          </button>
          <button className="btn btn-sm" disabled={ocupado} onClick={() => decidir(d, "descartada")}>
            Descartar
          </button>
          {d.alvo_autor && (
            <button className="btn btn-sm btn-danger" disabled={ocupado} onClick={() => banir(d)}>
              {banido(d.alvo_autor) ? "Readmitir" : "Suspender autor"}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="card">
      <div className="card-title">Moderação {abertas.length > 0 && `(${abertas.length})`}</div>
      {abertas.length === 0 && <div className="muted">Nenhuma denúncia aberta.</div>}
      <div className="stack" style={{ gap: "0.6rem" }}>{abertas.map(linha)}</div>

      {fechadas.length > 0 && (
        <>
          <button
            className="row between"
            onClick={() => setVerHistorico((v) => !v)}
            style={{ background: "none", border: "none", color: "inherit", width: "100%", cursor: "pointer", padding: "0.7rem 0 0" }}
          >
            <span className="muted">Já decididas ({fechadas.length})</span>
            <span className="muted">{verHistorico ? "▲" : "▼"}</span>
          </button>
          {verHistorico && (
            <div className="stack" style={{ gap: "0.6rem", marginTop: "0.6rem" }}>{fechadas.map(linha)}</div>
          )}
        </>
      )}
    </div>
  );
}
