"use client";

// Portão de entrada de quem recebeu senha provisória pelo direct. Enquanto a
// senha não for trocada, não há navegação: essa senha passou por um canal que
// não controlamos, então vale só para esta primeira vez.
import { useState, type FormEvent } from "react";

import { getSupabase } from "@/lib/supabase";

export default function TrocaSenha({ nome }: { nome?: string }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) return setErro("A senha precisa de ao menos 8 caracteres.");
    if (senha !== confirma) return setErro("As senhas não conferem.");

    const supabase = getSupabase();
    if (!supabase) return setErro("Backend indisponível.");

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setSalvando(false);
      return setErro(error.message);
    }

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", uid);
    }
    // recarrega para a sessão nascer já sem a pendência
    window.location.reload();
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="wm wordmark">
            wonder<b>blue</b>
          </div>
          <div className="tg">
            {nome ? `Boas-vindas, ${nome}.` : "Boas-vindas."} Crie sua senha.
          </div>
        </div>

        <p className="muted" style={{ fontSize: 13.5, marginBottom: "1.1rem" }}>
          A senha que você recebeu no direct serve só para esta primeira entrada. Escolha uma que
          seja sua.
        </p>

        <form className="auth-form" onSubmit={enviar}>
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mínimo 8 caracteres"
            />
          </div>
          <div className="field">
            <label>Repita a senha</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
            />
          </div>
          {erro && <div className="auth-error">{erro}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Entrar na rede"}
          </button>
        </form>
      </div>
    </div>
  );
}
