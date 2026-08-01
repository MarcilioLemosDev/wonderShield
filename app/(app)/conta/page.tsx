"use client";

// Minha conta: ver o próprio perfil, escrever a bio e trocar a própria senha.
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Profile = {
  handle: string;
  display_name: string;
  instagram: string | null;
  age: number | null;
  profession: string | null;
  bio: string | null;
};

export default function ContaPage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
  const [bioMsg, setBioMsg] = useState("");
  const [bioErr, setBioErr] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("handle, display_name, instagram, age, profession, bio")
        .eq("id", uid)
        .single();
      if (!active || !data) return;
      setProfile(data as Profile);
      setBio(data.bio ?? "");
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveBio = async (e: FormEvent) => {
    e.preventDefault();
    setBioMsg("");
    setBioErr("");
    const supabase = getSupabase();
    if (!supabase) return setBioErr("Backend indisponível (modo mock).");
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return setBioErr("Sessão expirada.");
    setSavingBio(true);
    const { error } = await supabase.from("profiles").update({ bio }).eq("id", uid);
    setSavingBio(false);
    if (error) return setBioErr(error.message);
    setBioMsg("Bio salva.");
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPassMsg("");
    setPassErr("");
    if (pass.length < 8) return setPassErr("A senha precisa de ao menos 8 caracteres.");
    if (pass !== confirm) return setPassErr("As senhas não conferem.");
    const supabase = getSupabase();
    if (!supabase) return setPassErr("Backend indisponível (modo mock).");
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setSavingPass(false);
    if (error) return setPassErr(error.message);
    setPass("");
    setConfirm("");
    setPassMsg("Senha alterada com sucesso.");
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">{profile?.display_name ?? session?.displayName}</div>
        <div className="muted">
          @{profile?.handle ?? session?.handle} · {session?.role}
          {profile?.age ? ` · ${profile.age} anos` : ""}
          {profile?.profession ? ` · ${profile.profession}` : ""}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Minha bio</div>
        {!isSupabaseConfigured && <div className="muted">Indisponível em modo mock.</div>}
        <form className="stack" onSubmit={saveBio}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Fale um pouco sobre você…"
            style={{ width: "100%", resize: "vertical" }}
          />
          {bioErr && <div className="auth-error">{bioErr}</div>}
          {bioMsg && <div className="muted" style={{ color: "var(--cyan, #35d0d0)" }}>{bioMsg}</div>}
          <button className="btn btn-primary" type="submit" disabled={savingBio || !isSupabaseConfigured}>
            {savingBio ? "Salvando..." : "Salvar bio"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Alterar minha senha</div>
        {!isSupabaseConfigured && <div className="muted">Indisponível em modo mock.</div>}
        <form className="stack" onSubmit={savePassword} style={{ maxWidth: 420 }}>
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
          {passErr && <div className="auth-error">{passErr}</div>}
          {passMsg && <div className="muted" style={{ color: "var(--cyan, #35d0d0)" }}>{passMsg}</div>}
          <button className="btn btn-primary" type="submit" disabled={savingPass || !isSupabaseConfigured}>
            {savingPass ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
