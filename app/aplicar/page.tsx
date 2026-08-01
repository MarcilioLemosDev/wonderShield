"use client";

// Página pública de candidatura. Sem login. A rede é só por aprovação: a pessoa
// se apresenta e o admin valida (olhando o Instagram) antes de criar o acesso.
import { useState, type FormEvent } from "react";

import { CIDADES } from "@/lib/cidades";
import { SIGNOS, RELACIONAMENTOS } from "@/lib/estelar";

export default function AplicarPage() {
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [age, setAge] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [sign, setSign] = useState("");
  const [relacionamento, setRelacionamento] = useState("");
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
        body: JSON.stringify({ name, instagram, age, profession, city, sign, relationship: relacionamento }),
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
          <div className="wm wordmark">
            wonder<b>blue</b>
          </div>
          <div className="tg">A conversa aqui vira encontro lá fora.</div>
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
            <p className="muted" style={{ fontSize: 13.5, marginBottom: "0.2rem" }}>
              Aqui dentro você não será chamado pelo seu nome — recebe um nome de estrela. Quem é
              quem se descobre no encontro.
            </p>

            <div className="field">
              <label>Seu nome</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="como te chamam" />
              <span className="hint">Fica só com a administração.</span>
            </div>
            <div className="field">
              <label>@ do Instagram</label>
              <input
                required
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@seuinsta"
              />
              <span className="hint">Serve para confirmar que existe gente de verdade aí.</span>
            </div>
            <div className="field">
              <label>Cidade</label>
              <select value={city} onChange={(e) => setCity(e.target.value)} required>
                <option value="">Escolha sua cidade</option>
                {CIDADES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Idade</label>
              <input
                type="number"
                min={13}
                max={120}
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Signo</label>
              <select value={sign} onChange={(e) => setSign(e.target.value)} required>
                <option value="">Escolha seu signo</option>
                {SIGNOS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.simbolo} {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Momento</label>
              <select
                value={relacionamento}
                onChange={(e) => setRelacionamento(e.target.value)}
                required
              >
                <option value="">Como você está hoje</option>
                {RELACIONAMENTOS.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.nome}
                  </option>
                ))}
              </select>
              <span className="hint">A rede começa pela amizade — mas é bom deixar claro.</span>
            </div>
            <div className="field">
              <label>Profissão</label>
              <input
                required
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="o que você faz"
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
