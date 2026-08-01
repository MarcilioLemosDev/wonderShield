"use client";

// Página pública de "esqueci a senha". Sem login. A pessoa informa o @; o pedido
// vai para a fila do admin, que reseta e envia a senha provisória pelo direct.
import { useState, type FormEvent } from "react";

export default function EsqueciPage() {
  const [identifier, setIdentifier] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível enviar.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="shield">🔵</div>
          <div className="wm wordmark">
            WONDER<b>BLUE</b>
          </div>
          <div className="tg">Recuperar acesso</div>
        </div>

        {done ? (
          <div className="stack">
            <div className="muted" style={{ textAlign: "center" }}>
              Pedido enviado. Você vai receber uma <b>senha provisória no direct do Instagram</b>.
              Ao entrar, troque a senha em “Minha conta”.
            </div>
            <a className="btn btn-primary btn-block" href="/login">
              Voltar ao login
            </a>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div className="field">
              <label>@ do Instagram</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="@seuinsta"
              />
            </div>
            <div className="field">
              <label>Recado (opcional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="algo que ajude a te identificar"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Enviando..." : "Pedir nova senha"}
            </button>
          </form>
        )}

        <div className="auth-note" style={{ textAlign: "center" }}>
          <a href="/login">Voltar ao login</a>
        </div>
      </div>
    </div>
  );
}
