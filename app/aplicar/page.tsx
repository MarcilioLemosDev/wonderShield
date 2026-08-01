"use client";

// Página pública de candidatura. Sem login. A rede é só por aprovação: a pessoa
// se apresenta e o admin valida (olhando o Instagram) antes de criar o acesso.
import { useState, type FormEvent } from "react";

export default function AplicarPage() {
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [age, setAge] = useState("");
  const [profession, setProfession] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instagram, age, profession }),
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
          <div className="tg">Uma rede sem anúncios · presença de verdade</div>
        </div>

        {done ? (
          <div className="stack">
            <div className="muted" style={{ textAlign: "center" }}>
              Candidatura enviada. Se aprovada, você recebe o acesso pelo <b>direct do Instagram</b>.
            </div>
            <a className="btn btn-primary btn-block" href="/login">
              Voltar ao login
            </a>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div className="field">
              <label>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="como te chamam" />
            </div>
            <div className="field">
              <label>@ do Instagram</label>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@seuinsta"
              />
            </div>
            <div className="field">
              <label>Idade</label>
              <input
                type="number"
                min={13}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="field">
              <label>Profissão</label>
              <input
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="opcional"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Enviando..." : "Enviar candidatura"}
            </button>
          </form>
        )}

        <div className="auth-note" style={{ textAlign: "center" }}>
          O acesso é validado pelo seu perfil no Instagram. Já tem conta?{" "}
          <a href="/login">Entrar</a>
        </div>
      </div>
    </div>
  );
}
