"use client";

// A página da tribo — o grupo como lugar. Cabeçalho, quem é de lá, o mural (o
// feed em 'tribo:<id>') e a porta. Quem é membro lê e publica; quem não é vê o
// convite e pede pra entrar. Quem manda na tribo (admin da rede ou admin da
// própria tribo) decide os pedidos aqui mesmo.
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { nomeDaCidade } from "@/lib/cidades";
import FeedEscopo from "@/components/FeedEscopo";

type Tribo = { id: string; nome: string; descricao: string | null; city: string | null; permite_pedido: boolean };
type Membro = { pessoa: string; admin: boolean; nome: string };
type Pedido = { pessoa: string; nome: string; created_at: string };

export default function TriboPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const triboId = params?.id;

  const [meuId, setMeuId] = useState<string | null>(null);
  const [tribo, setTribo] = useState<Tribo | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pediEu, setPediEu] = useState(false);
  const [erro, setErro] = useState("");
  const [naoAchou, setNaoAchou] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const ehAdminRede = session?.role === "admin";

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !triboId) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    setMeuId(uid);

    const { data: t, error: et } = await supabase
      .from("tribos")
      .select("id, nome, descricao, city, permite_pedido")
      .eq("id", triboId)
      .single();
    if (et || !t) {
      setNaoAchou(true);
      return;
    }
    setTribo(t as Tribo);

    const { data: ms } = await supabase
      .from("tribo_membros")
      .select("pessoa, admin")
      .eq("tribo_id", triboId);
    const linhas = (ms ?? []) as { pessoa: string; admin: boolean }[];

    // nomes estelares dos membros
    const ids = linhas.map((l) => l.pessoa);
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data: perfis } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      for (const p of (perfis ?? []) as { id: string; display_name: string }[]) nomes.set(p.id, p.display_name);
    }
    setMembros(linhas.map((l) => ({ ...l, nome: nomes.get(l.pessoa) ?? "membro" })));

    // pedidos: a RLS devolve os meus e, se eu mando na tribo, os de todos
    const { data: ps } = await supabase
      .from("tribo_pedidos")
      .select("pessoa, created_at")
      .eq("tribo_id", triboId)
      .order("created_at", { ascending: true });
    const pedRows = (ps ?? []) as { pessoa: string; created_at: string }[];
    setPediEu(pedRows.some((p) => p.pessoa === uid));
    const idsPed = pedRows.map((p) => p.pessoa).filter((id) => !nomes.has(id));
    if (idsPed.length) {
      const { data: perfis2 } = await supabase.from("profiles").select("id, display_name").in("id", idsPed);
      for (const p of (perfis2 ?? []) as { id: string; display_name: string }[]) nomes.set(p.id, p.display_name);
    }
    setPedidos(pedRows.map((p) => ({ ...p, nome: nomes.get(p.pessoa) ?? "membro" })));
  }, [triboId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const souMembro = !!meuId && membros.some((m) => m.pessoa === meuId);
  const souAdminTribo = !!meuId && membros.some((m) => m.pessoa === meuId && m.admin);
  const mando = ehAdminRede || souAdminTribo;

  const pedir = async () => {
    const supabase = getSupabase();
    if (!supabase || !tribo || !meuId) return;
    setErro("");
    setOcupado(true);
    try {
      const { error } = await supabase.from("tribo_pedidos").insert({ tribo_id: tribo.id, pessoa: meuId });
      if (error) return setErro("Não deu pra enviar o pedido agora.");
      setPediEu(true);
    } finally {
      setOcupado(false);
    }
  };

  const desistir = async () => {
    const supabase = getSupabase();
    if (!supabase || !tribo || !meuId) return;
    setOcupado(true);
    try {
      await supabase.from("tribo_pedidos").delete().eq("tribo_id", tribo.id).eq("pessoa", meuId);
      setPediEu(false);
    } finally {
      setOcupado(false);
    }
  };

  const sair = async () => {
    const supabase = getSupabase();
    if (!supabase || !tribo || !meuId) return;
    if (!window.confirm(`Sair da tribo "${tribo.nome}"?`)) return;
    setOcupado(true);
    try {
      await supabase.from("tribo_membros").delete().eq("tribo_id", tribo.id).eq("pessoa", meuId);
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const aprovar = async (pessoa: string) => {
    const supabase = getSupabase();
    if (!supabase || !tribo) return;
    setOcupado(true);
    try {
      const { error } = await supabase.rpc("aprovar_pedido", { p_tribo: tribo.id, p_pessoa: pessoa });
      if (error) setErro("Não deu pra aprovar agora.");
      await carregar();
    } finally {
      setOcupado(false);
    }
  };

  const recusar = async (pessoa: string) => {
    const supabase = getSupabase();
    if (!supabase || !tribo) return;
    setOcupado(true);
    try {
      await supabase.from("tribo_pedidos").delete().eq("tribo_id", tribo.id).eq("pessoa", pessoa);
      setPedidos((prev) => prev.filter((p) => p.pessoa !== pessoa));
    } finally {
      setOcupado(false);
    }
  };

  if (!isSupabaseConfigured) return <div className="card muted">Indisponível em modo mock.</div>;
  if (naoAchou)
    return (
      <div className="stack">
        <div className="card auth-error">Tribo não encontrada.</div>
        <button className="btn btn-sm" onClick={() => router.push("/tribos")}>
          Ver todas as tribos
        </button>
      </div>
    );
  if (!tribo) return <div className="card muted">Carregando…</div>;

  return (
    <div className="stack">
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/tribos")}>
        ← Tribos
      </button>

      {/* cabeçalho da tribo */}
      <div className="card">
        <div className="tribo-cabeca">
          <div style={{ minWidth: 0 }}>
            <div className="tribo-titulo">{tribo.nome}</div>
            <div className="muted" style={{ fontSize: 13.5 }}>
              {nomeDaCidade(tribo.city) ? `${nomeDaCidade(tribo.city)} · ` : ""}
              {membros.length} {membros.length === 1 ? "pessoa" : "pessoas"}
            </div>
          </div>
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            {souMembro ? (
              <>
                <Link href="/chat" className="btn btn-sm btn-primary">
                  Conversa
                </Link>
                <button className="btn btn-sm btn-danger" disabled={ocupado} onClick={sair}>
                  Sair
                </button>
              </>
            ) : pediEu ? (
              <button className="btn btn-sm" disabled={ocupado} onClick={desistir}>
                Pedido enviado ✕
              </button>
            ) : tribo.permite_pedido ? (
              <button className="btn btn-sm btn-primary" disabled={ocupado} onClick={pedir}>
                Pedir pra entrar
              </button>
            ) : (
              <span className="tag">só por convite</span>
            )}
          </div>
        </div>
        {tribo.descricao && <div style={{ marginTop: "0.6rem", lineHeight: 1.5 }}>{tribo.descricao}</div>}
        {erro && <div className="auth-error" style={{ marginTop: "0.6rem" }}>{erro}</div>}
      </div>

      {/* pedidos pendentes — só para quem manda na tribo */}
      {mando && pedidos.length > 0 && (
        <div className="card">
          <div className="card-title">Pedidos pra entrar ({pedidos.length})</div>
          <div className="stack" style={{ gap: "0.5rem" }}>
            {pedidos.map((p) => (
              <div key={p.pessoa} className="row between" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                <Link href={`/u/${p.pessoa}`} className="msg-author">
                  {p.nome}
                </Link>
                <div className="row" style={{ gap: "0.35rem" }}>
                  <button className="btn btn-sm btn-primary" disabled={ocupado} onClick={() => aprovar(p.pessoa)}>
                    Aprovar
                  </button>
                  <button className="btn btn-sm" disabled={ocupado} onClick={() => recusar(p.pessoa)}>
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* quem é de lá */}
      <div className="card">
        <div className="card-title">Quem é de lá</div>
        {membros.length === 0 ? (
          <div className="muted">Tribo vazia ainda.</div>
        ) : (
          <div className="confirmados">
            {membros.map((m) => (
              <Link key={m.pessoa} href={`/u/${m.pessoa}`} className="quem-vai">
                <span className="avatar">{m.nome.slice(0, 2).toUpperCase()}</span>
                {m.nome}
                {m.admin && <span className="tag" style={{ marginLeft: "0.3rem" }}>comando</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* o mural da tribo */}
      {souMembro ? (
        <FeedEscopo
          scope={`tribo:${tribo.id}`}
          escopoNome={tribo.nome}
          meuId={meuId}
          meuNome={session?.displayName ?? "membro"}
          ehAdmin={!!ehAdminRede}
        />
      ) : (
        <div className="card muted">
          O mural e a conversa da tribo são de quem é de lá. {tribo.permite_pedido ? "Peça pra entrar e descubra o que rola aqui." : "Esta tribo é só por convite."}
        </div>
      )}
    </div>
  );
}
