"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn, session, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace("/home");
  }, [ready, session, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) router.replace("/home");
    else setError(result.error ?? "Falha ao entrar.");
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="shield">🛡️</div>
          <div className="wm wordmark">
            WONDER<b>SHIELD</b>
          </div>
          <div className="tg">Acesso restrito · console de operações</div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@wondershield.dev"
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
        <div className="auth-note">
          A rede cresce só por <b>convite</b>. Sem conta? Peça a um membro.
        </div>
      </div>
    </div>
  );
}
