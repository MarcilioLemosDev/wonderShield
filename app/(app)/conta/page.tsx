"use client";

// Minha conta. Por ora: trocar a própria senha (via Supabase Auth, com a sessão
// do próprio usuário). Acessível a qualquer usuário logado.
import { useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function ContaPage() {
  const { session } = useAuth();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (pass.length < 8) {
      setError("A senha precisa de ao menos 8 caracteres.");
      return;
    }
    if (pass !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError("Backend indisponível (modo mock).");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPass("");
    setConfirm("");
    setMsg("Senha alterada com sucesso.");
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">Minha conta</div>
        <div className="muted">
          {session?.displayName} · @{session?.handle} · {session?.role}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Alterar minha senha</div>
        {!isSupabaseConfigured && (
          <div className="muted">Indisponível em modo mock (sem Supabase).</div>
        )}
        <form className="stack" onSubmit={submit} style={{ maxWidth: 420 }}>
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
              placeholder="mínimo 8 caracteres"
            />
          </div>
          <div className="field">
            <label>Confirmar nova senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          {msg && <div className="muted" style={{ color: "var(--cyan, #35d0d0)" }}>{msg}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
