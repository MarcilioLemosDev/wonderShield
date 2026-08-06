"use client";

// Mensagens diretas. Lista de conversas + a conversa aberta. Uma thread por par
// de pessoas; a identidade continua sendo o nome estelar. No celular, abrir uma
// conversa esconde a lista (padrão messenger).
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import Avatar from "@/components/Avatar";

type Thread = { id: string; user_a: string; user_b: string; last_at: string };
type Msg = { id: string; thread_id: string; sender: string; body: string; read: boolean; created_at: string };

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function DmPage() {
  const params = useSearchParams();
  const [meuId, setMeuId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [naoLidas, setNaoLidas] = useState<Map<string, number>>(new Map());
  const [aberta, setAberta] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const outro = useCallback((t: Thread) => (t.user_a === meuId ? t.user_b : t.user_a), [meuId]);

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    setMeuId(uid);
    if (!uid) return;

    const { data: ts } = await supabase
      .from("dm_threads")
      .select("id, user_a, user_b, last_at")
      .order("last_at", { ascending: false });
    const lista = (ts ?? []) as Thread[];
    setThreads(lista);

    // nomes estelares dos outros participantes
    const outros = lista.map((t) => (t.user_a === uid ? t.user_b : t.user_a));
    if (outros.length) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", outros);
      setNomes(new Map(((perfis ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name])));
    }

    // não-lidas por thread
    const { data: pend } = await supabase
      .from("dm_messages")
      .select("thread_id, sender, read")
      .eq("read", false)
      .neq("sender", uid);
    const mapa = new Map<string, number>();
    for (const m of (pend ?? []) as Msg[]) mapa.set(m.thread_id, (mapa.get(m.thread_id) ?? 0) + 1);
    setNaoLidas(mapa);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // deep-link ?t=<thread>
  useEffect(() => {
    const t = params.get("t");
    if (t) setAberta(t);
  }, [params]);

  // carrega mensagens da conversa aberta + marca lidas
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !aberta || !meuId) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("dm_messages")
        .select("id, thread_id, sender, body, read, created_at")
        .eq("thread_id", aberta)
        .order("created_at", { ascending: true });
      if (!ativo) return;
      setMsgs((data ?? []) as Msg[]);
      // marca as recebidas como lidas
      const naoLidasIds = ((data ?? []) as Msg[]).filter((m) => m.sender !== meuId && !m.read).map((m) => m.id);
      if (naoLidasIds.length) {
        await supabase.from("dm_messages").update({ read: true }).in("id", naoLidasIds);
        setNaoLidas((prev) => {
          const n = new Map(prev);
          n.delete(aberta);
          return n;
        });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [aberta, meuId]);

  // realtime: novas mensagens nas minhas threads
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !meuId) return;
    const canal = supabase
      .channel("minhas-dms")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, (payload) => {
        const m = payload.new as Msg;
        if (m.thread_id === aberta) {
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender !== meuId) void supabase.from("dm_messages").update({ read: true }).eq("id", m.id);
        } else if (m.sender !== meuId) {
          setNaoLidas((prev) => new Map(prev).set(m.thread_id, (prev.get(m.thread_id) ?? 0) + 1));
        }
        void carregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [meuId, aberta, carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const body = texto.trim();
    if (!body || !aberta || !meuId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setErro("");
    setTexto("");
    const { data, error } = await supabase
      .from("dm_messages")
      .insert({ thread_id: aberta, sender: meuId, body })
      .select("id, thread_id, sender, body, read, created_at")
      .single();
    if (error) {
      setErro(error.message);
      setTexto(body);
      return;
    }
    if (data) setMsgs((prev) => [...prev, data as Msg]);
  };

  if (!isSupabaseConfigured) {
    return <div className="card muted">Mensagens indisponíveis em modo mock.</div>;
  }

  const threadAberta = threads.find((t) => t.id === aberta);
  const nomeAberto = threadAberta ? (nomes.get(outro(threadAberta)) ?? "membro") : "";

  return (
    <div className={`dm${aberta ? " com-aberta" : ""}`}>
      {/* lista de conversas */}
      <div className="dm-lista card">
        <div className="card-title">Conversas</div>
        {threads.length === 0 && (
          <div className="muted">
            Nenhuma conversa ainda. Abra o perfil de alguém na Rede e mande a primeira mensagem.
          </div>
        )}
        {threads.map((t) => {
          const id = outro(t);
          const nome = nomes.get(id) ?? "membro";
          const n = naoLidas.get(t.id) ?? 0;
          return (
            <button
              key={t.id}
              className={`dm-conversa${aberta === t.id ? " ativa" : ""}`}
              onClick={() => setAberta(t.id)}
            >
              <Avatar nome={nome} seed={id} />
              <span className="dm-conversa-nome">{nome}</span>
              {n > 0 && <span className="dm-nao-lida">{n}</span>}
            </button>
          );
        })}
      </div>

      {/* conversa aberta */}
      <div className="dm-conversa-aberta card">
        {!threadAberta ? (
          <div className="muted" style={{ margin: "auto" }}>
            Escolha uma conversa.
          </div>
        ) : (
          <>
            <div className="dm-cabeca">
              <button className="btn btn-sm dm-voltar" onClick={() => setAberta(null)}>
                ←
              </button>
              <Link href={`/u/${outro(threadAberta)}`} className="dm-cabeca-nome">
                {nomeAberto}
              </Link>
            </div>

            <div className="dm-mensagens">
              {msgs.map((m) => (
                <div key={m.id} className={`dm-bolha${m.sender === meuId ? " minha" : ""}`}>
                  <div>{m.body}</div>
                  <span className="dm-hora">{hora(m.created_at)}</span>
                </div>
              ))}
              <div ref={fim} />
            </div>

            {erro && <div className="auth-error">{erro}</div>}
            <form className="compositor" onSubmit={enviar}>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={`Mensagem para ${nomeAberto}…`}
                maxLength={4000}
              />
              <button className="btn btn-primary" type="submit" disabled={!texto.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
