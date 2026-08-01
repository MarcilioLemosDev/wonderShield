"use client";

// Bate-papo geral. Uma sala só. A janela de 12h "fecha" sozinha: quando o
// relógio cruza 00h/12h, o bloco atual é movido para o histórico e a sala ao
// vivo zera — sem recarregar a página. Histórico é derivado do created_at das
// mensagens, agrupado por janela.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { currentWindow, windowOf, type ChatWindow } from "@/lib/chatWindow";

type Message = {
  id: string;
  author: string;
  author_name: string;
  body: string;
  created_at: string;
};

// Agrupa mensagens antigas em janelas de 12h, mais recentes primeiro.
function groupHistory(msgs: Message[]): { window: ChatWindow; messages: Message[] }[] {
  const byKey = new Map<string, { window: ChatWindow; messages: Message[] }>();
  for (const m of msgs) {
    const w = windowOf(new Date(m.created_at));
    const bucket = byKey.get(w.key) ?? { window: w, messages: [] };
    bucket.messages.push(m);
    byKey.set(w.key, bucket);
  }
  return Array.from(byKey.values()).sort(
    (a, b) => b.window.start.getTime() - a.window.start.getTime(),
  );
}

export default function ChatPage() {
  const { session } = useAuth();
  const [win, setWin] = useState<ChatWindow>(() => currentWindow());
  const [live, setLive] = useState<Message[]>([]);
  const [past, setPast] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [openHistory, setOpenHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const addLive = useCallback((m: Message) => {
    setLive((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  // Carga inicial: mensagens da janela atual (ao vivo) + anteriores (histórico).
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const w = currentWindow();
    setWin(w);

    (async () => {
      const [liveRes, pastRes] = await Promise.all([
        supabase
          .from("messages")
          .select("id, author, author_name, body, created_at")
          .gte("created_at", w.start.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("messages")
          .select("id, author, author_name, body, created_at")
          .lt("created_at", w.start.toISOString())
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (!active) return;
      if (liveRes.error) setError(liveRes.error.message);
      setLive((liveRes.data ?? []) as Message[]);
      setPast((pastRes.data ?? []) as Message[]);
    })();

    // Realtime: novas mensagens entram na sala ao vivo.
    const channel = supabase
      .channel("messages-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (new Date(m.created_at) >= currentWindow().start) addLive(m);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [addLive]);

  // Rollover: a cada 20s checa se a janela virou. Se virou, consolida o bloco
  // atual no histórico e zera a sala ao vivo.
  useEffect(() => {
    const t = setInterval(() => {
      const now = currentWindow();
      if (now.key !== win.key) {
        setPast((prev) => [...live, ...prev]);
        setLive([]);
        setWin(now);
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [win, live]);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [live.length]);

  const history = useMemo(() => groupHistory(past), [past]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setError("");
    setText("");

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      setError("Sessão expirada. Recarregue a página.");
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({ author: uid, author_name: session?.displayName ?? "Operador", body })
      .select("id, author, author_name, body, created_at")
      .single();
    if (error) {
      setError(error.message);
      setText(body);
      return;
    }
    if (data) addLive(data as Message);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="card">
        <div className="muted">
          Bate-papo indisponível em modo mock (sem <code>NEXT_PUBLIC_SUPABASE_*</code>). Conecte o
          Supabase para conversar.
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="card-title" style={{ margin: 0 }}>
            Sala ao vivo
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            janela atual · {win.label} · fecha em {timeLeft(win)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxHeight: "52vh",
            overflowY: "auto",
            padding: "0.4rem 0.1rem",
          }}
        >
          {live.length === 0 && <div className="muted">Sala vazia. Comece a conversa 👋</div>}
          {live.map((m) => (
            <MessageBubble key={m.id} m={m} mine={m.author_name === session?.displayName} />
          ))}
          <div ref={endRef} />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="row" style={{ gap: "0.5rem", marginTop: "0.6rem" }} onSubmit={send}>
          <input
            style={{ flex: 1 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva uma mensagem…"
            maxLength={2000}
          />
          <button className="btn btn-primary" type="submit">
            Enviar
          </button>
        </form>
      </div>

      <div className="card">
        <button
          className="row"
          onClick={() => setOpenHistory((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <span className="card-title" style={{ margin: 0 }}>
            Histórico consolidado
          </span>
          <span className="muted">
            {history.length} {history.length === 1 ? "janela" : "janelas"} {openHistory ? "▲" : "▼"}
          </span>
        </button>

        {openHistory && (
          <div className="stack" style={{ marginTop: "0.7rem" }}>
            {history.length === 0 && <div className="muted">Nenhuma janela fechada ainda.</div>}
            {history.map((h) => (
              <details key={h.window.key} className="card" style={{ padding: "0.7rem 0.9rem" }}>
                <summary style={{ cursor: "pointer" }}>
                  <b>{h.window.label}</b>{" "}
                  <span className="muted">· {h.messages.length} mensagens</span>
                </summary>
                <div className="stack" style={{ marginTop: "0.6rem", gap: "0.4rem" }}>
                  {h.messages
                    .slice()
                    .sort((a, b) => a.created_at.localeCompare(b.created_at))
                    .map((m) => (
                      <MessageBubble key={m.id} m={m} mine={m.author_name === session?.displayName} />
                    ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  const time = new Date(m.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "80%",
        background: mine ? "rgba(53,153,255,0.16)" : "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "0.45rem 0.65rem",
      }}
    >
      <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
        <Link href={`/u/${m.author}`} className="msg-author">
          {m.author_name}
        </Link>{" "}
        · {time}
      </div>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
    </div>
  );
}

function timeLeft(win: ChatWindow): string {
  const ms = win.end.getTime() - Date.now();
  if (ms <= 0) return "0min";
  const h = Math.floor(ms / 3600_000);
  const min = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h${String(min).padStart(2, "0")}` : `${min}min`;
}
