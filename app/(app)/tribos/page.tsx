"use client";

// Tribos — o diretório de grupos da rede. Todo membro vê que tribos existem,
// quantos são e do que tratam. A porta de cada uma é o pedido de entrada: se a
// tribo aceita pedidos e você ainda não é de lá, dá pra pedir daqui mesmo. Quem
// manda na tribo aprova na página da tribo.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { nomeDaCidade } from "@/lib/cidades";

type Tribo = { id: string; nome: string; descricao: string | null; city: string | null; permite_pedido: boolean };

export default function TribosPage() {
  const [meuId, setMeuId] = useState<string | null>(null);
  const [tribos, setTribos] = useState<Tribo[] | null>(null);
  const [contagem, setContagem] = useState<Map<string, number>>(new Map());
  const [souMembro, setSouMembro] = useState<Set<string>>(new Set());
  const [pedi, setPedi] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    setMeuId(uid);

    const [t, m, p] = await Promise.all([
      supabase.from("tribos").select("id, nome, descricao, city, permite_pedido").order("nome"),
      supabase.from("tribo_membros").select("tribo_id, pessoa"),
      supabase.from("tribo_pedidos").select("tribo_id, pessoa"),
    ]);

    setTribos((t.data ?? []) as Tribo[]);

    const cont = new Map<string, number>();
    const meus = new Set<string>();
    for (const row of (m.data ?? []) as { tribo_id: string; pessoa: string }[]) {
      cont.set(row.tribo_id, (cont.get(row.tribo_id) ?? 0) + 1);
      if (row.pessoa === uid) meus.add(row.tribo_id);
    }
    setContagem(cont);
    setSouMembro(meus);

    // a RLS de tribo_pedidos só me devolve os meus (e os de tribos que gerencio)
    const pedidos = new Set<string>();
    for (const row of (p.data ?? []) as { tribo_id: string; pessoa: string }[]) {
      if (row.pessoa === uid) pedidos.add(row.tribo_id);
    }
    setPedi(pedidos);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pedir = async (tribo: Tribo) => {
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    setErro("");
    setOcupado(tribo.id);
    try {
      const { error } = await supabase.from("tribo_pedidos").insert({ tribo_id: tribo.id, pessoa: meuId });
      if (error) {
        setErro("Não deu pra enviar o pedido agora.");
        return;
      }
      setPedi((prev) => new Set(prev).add(tribo.id));
    } finally {
      setOcupado(null);
    }
  };

  const desistir = async (tribo: Tribo) => {
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    setOcupado(tribo.id);
    try {
      await supabase.from("tribo_pedidos").delete().eq("tribo_id", tribo.id).eq("pessoa", meuId);
      setPedi((prev) => {
        const n = new Set(prev);
        n.delete(tribo.id);
        return n;
      });
    } finally {
      setOcupado(null);
    }
  };

  if (!isSupabaseConfigured) {
    return <div className="card muted">Tribos indisponíveis em modo mock.</div>;
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">Tribos</div>
        <div className="muted">
          Grupos dentro da rede. Entre numa tribo pra ter mural e conversa só de quem é de lá — e mais
          gente por perto pra virar encontro.
        </div>
      </div>

      {erro && <div className="card auth-error">{erro}</div>}
      {!tribos && <div className="card muted">Carregando…</div>}
      {tribos && tribos.length === 0 && <div className="card muted">Nenhuma tribo ainda.</div>}

      {tribos?.map((t) => {
        const n = contagem.get(t.id) ?? 0;
        const membro = souMembro.has(t.id);
        const pendente = pedi.has(t.id);
        return (
          <div key={t.id} className="card tribo-card">
            <div className="tribo-card-topo">
              <div style={{ minWidth: 0 }}>
                <Link href={`/tribos/${t.id}`} className="tribo-card-nome">
                  {t.nome}
                </Link>
                <div className="muted" style={{ fontSize: 13 }}>
                  {nomeDaCidade(t.city) ? `${nomeDaCidade(t.city)} · ` : ""}
                  {n} {n === 1 ? "pessoa" : "pessoas"}
                </div>
                {t.descricao && <div className="tribo-card-desc">{t.descricao}</div>}
              </div>

              <div className="tribo-card-acao">
                {membro ? (
                  <Link href={`/tribos/${t.id}`} className="btn btn-sm">
                    Abrir
                  </Link>
                ) : pendente ? (
                  <button
                    className="btn btn-sm"
                    disabled={ocupado === t.id}
                    onClick={() => desistir(t)}
                    title="Cancelar pedido"
                  >
                    Pedido enviado ✕
                  </button>
                ) : t.permite_pedido ? (
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={ocupado === t.id}
                    onClick={() => pedir(t)}
                  >
                    Pedir pra entrar
                  </button>
                ) : (
                  <span className="tag">só por convite</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
