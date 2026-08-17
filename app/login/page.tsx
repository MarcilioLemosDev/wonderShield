"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth, MOCK_ATIVO } from "@/lib/auth";

export default function LoginPage() {
  const { signIn, session, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace("/feed");
  }, [ready, session, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) router.replace("/feed");
    else setError(result.error ?? "Falha ao entrar.");
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="wm wordmark">
            wonder<b>blue</b>
          </div>
          <div className="tg">Sem anúncios. Só quem foi convidado.</div>
        </div>
        {/* Sem backend, qualquer senha entra. Dizer isso na cara evita que um
            preview seja confundido com a rede de verdade. */}
        {MOCK_ATIVO && (
          <div className="auth-error" style={{ background: "transparent" }}>
            <b>Modo demonstração</b> — sem banco conectado. Qualquer senha entra e nada é
            salvo.
          </div>
        )}
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label>@ do Instagram</label>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="@seuinsta"
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="auth-note" style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <a href="/esqueci">Esqueci a senha</a>
          <a href="/aplicar">Quer entrar? Aplique</a>
        </div>
      </div>
    </div>
  );
}
