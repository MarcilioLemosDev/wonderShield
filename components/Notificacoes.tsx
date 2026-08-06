"use client";

// O sino: contador de não-lidas e um painel com o que aconteceu. Vive na topbar,
// então aparece igual no desktop e no celular.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useNotificacoes, type Notificacao } from "@/lib/notificacoes";

function tempo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function frase(n: Notificacao): string {
  const quem = n.actor_name ?? "alguém";
  if (n.tipo === "reacao") return `${quem} reagiu ao seu post`;
  if (n.tipo === "comentario") return `${quem} comentou: "${n.preview ?? ""}"`;
  return `${quem} respondeu você: "${n.preview ?? ""}"`;
}

export default function Notificacoes() {
  const { itens, naoLidas, marcarTodasLidas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const abrir = () => {
    setAberto((v) => !v);
    if (!aberto && naoLidas > 0) void marcarTodasLidas();
  };

  const ir = (n: Notificacao) => {
    setAberto(false);
    // sem permalink de post ainda: leva ao feed do escopo onde o post vive
    router.push(n.scope && n.scope !== "geral" ? `/feed` : "/feed");
  };

  return (
    <div className="sino-wrap" ref={ref}>
      <button className="sino" aria-label="Notificações" onClick={abrir}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {naoLidas > 0 && <span className="sino-badge">{naoLidas > 9 ? "9+" : naoLidas}</span>}
      </button>

      {aberto && (
        <div className="sino-painel">
          <div className="sino-cabeca">Notificações</div>
          {itens.length === 0 ? (
            <div className="muted" style={{ padding: "0.9rem 1rem" }}>
              Nada por aqui ainda.
            </div>
          ) : (
            <div className="sino-lista">
              {itens.map((n) => (
                <button
                  key={n.id}
                  className={`sino-item${n.read ? "" : " novo"}`}
                  onClick={() => ir(n)}
                >
                  <span className="sino-frase">{frase(n)}</span>
                  <span className="sino-tempo">{tempo(n.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
