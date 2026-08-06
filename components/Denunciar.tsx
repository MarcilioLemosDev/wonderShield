"use client";

// Denunciar — o sinal que qualquer membro levanta sobre um post, um comentário
// ou uma pessoa. Guarda um trecho do conteúdo na hora, para a fila da moderação
// ter contexto mesmo se o original sumir. Some pra fila da administração; o alvo
// não sabe quem sinalizou.
import { useState } from "react";

import { getSupabase } from "@/lib/supabase";

type AlvoTipo = "post" | "comentario" | "mensagem" | "perfil";

export default function Denunciar({
  alvoTipo,
  alvoId,
  alvoAutor,
  trecho,
  variante = "link",
  rotulo = "Denunciar",
}: {
  alvoTipo: AlvoTipo;
  alvoId?: string | null;
  alvoAutor?: string | null;
  trecho?: string | null;
  variante?: "link" | "botao";
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviada">("idle");
  const [erro, setErro] = useState("");

  const enviar = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setErro("");
    setEstado("enviando");
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      setErro("Sessão expirada.");
      setEstado("idle");
      return;
    }
    const { error } = await supabase.from("denuncias").insert({
      denunciante: uid,
      alvo_tipo: alvoTipo,
      alvo_id: alvoId ?? null,
      alvo_autor: alvoAutor ?? null,
      trecho: trecho ? trecho.slice(0, 300) : null,
      motivo: motivo.trim() || null,
    });
    if (error) {
      setErro("Não deu pra enviar agora.");
      setEstado("idle");
      return;
    }
    setEstado("enviada");
    setTimeout(() => {
      setAberto(false);
      setEstado("idle");
      setMotivo("");
    }, 1400);
  };

  return (
    <>
      <button
        type="button"
        className={variante === "botao" ? "btn btn-sm" : "comentario-acao"}
        onClick={() => setAberto(true)}
      >
        {rotulo}
      </button>

      {aberto && (
        <div className="modal-fundo" onClick={() => estado !== "enviando" && setAberto(false)}>
          <div className="modal-caixa card" onClick={(e) => e.stopPropagation()}>
            {estado === "enviada" ? (
              <div className="stack" style={{ alignItems: "center", gap: "0.5rem" }}>
                <div className="card-title" style={{ margin: 0 }}>
                  Denúncia enviada ✓
                </div>
                <div className="muted" style={{ textAlign: "center" }}>
                  A administração vai olhar. Obrigado por cuidar da rede.
                </div>
              </div>
            ) : (
              <>
                <div className="card-title" style={{ margin: 0 }}>
                  Denunciar
                </div>
                <div className="muted" style={{ fontSize: 13.5, marginBottom: "0.6rem" }}>
                  {alvoTipo === "perfil"
                    ? "Sinalizar esta pessoa para a administração."
                    : "Sinalizar este conteúdo para a administração."}{" "}
                  Só a administração vê — o alvo não sabe quem denunciou.
                </div>
                {trecho && (
                  <div className="comentario-corpo" style={{ marginBottom: "0.6rem", fontSize: 13.5 }}>
                    {trecho.slice(0, 200)}
                  </div>
                )}
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="O que houve? (opcional)"
                  style={{ width: "100%", resize: "vertical" }}
                />
                {erro && <div className="auth-error">{erro}</div>}
                <div className="row" style={{ gap: "0.4rem", marginTop: "0.6rem", justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-sm"
                    disabled={estado === "enviando"}
                    onClick={() => setAberto(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={estado === "enviando"}
                    onClick={enviar}
                  >
                    {estado === "enviando" ? "Enviando…" : "Enviar denúncia"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
