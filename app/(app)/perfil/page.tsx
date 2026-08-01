"use client";

// Meu perfil. Padrão de rede social, enxuto: avatar, nome, @, chips de
// idade/profissão e bio — com edição inline. A troca de senha fica em
// "Minha conta" (/conta).
import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";

type Profile = {
  handle: string;
  display_name: string;
  instagram: string | null;
  age: number | null;
  profession: string | null;
  bio: string | null;
  city: string | null;
};

export default function PerfilPage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // campos editáveis
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");

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
        .select("handle, display_name, instagram, age, profession, bio, city")
        .eq("id", uid)
        .single();
      if (!active || !data) return;
      const p = data as Profile;
      setProfile(p);
      setName(p.display_name ?? "");
      setProfession(p.profession ?? "");
      setAge(p.age ? String(p.age) : "");
      setBio(p.bio ?? "");
      setCity(p.city ?? "");
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setError("");
    setMsg("");
    const supabase = getSupabase();
    if (!supabase) return setError("Backend indisponível (modo mock).");
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return setError("Sessão expirada.");

    const ageNum = age.trim() === "" ? null : Number(age);
    if (ageNum !== null && (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120)) {
      return setError("Idade inválida.");
    }
    if (name.trim().length < 2) return setError("Informe seu nome.");

    setSaving(true);
    const patch = {
      display_name: name.trim(),
      profession: profession.trim() || null,
      age: ageNum,
      bio: bio.trim() || null,
      city: city || null,
    };
    const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
    setSaving(false);
    if (error) return setError(error.message);
    setProfile((p) => (p ? { ...p, ...patch } : p));
    setEditing(false);
    setMsg("Perfil atualizado.");
  };

  const handle = profile?.handle ?? session?.handle ?? "";
  const initials = (profile?.display_name ?? session?.displayName ?? "OP").slice(0, 2).toUpperCase();

  return (
    <div className="stack">
      <div className="card">
        <div className="profile-head">
          <span className="avatar">{initials}</span>
          <div className="profile-id">
            <div className="name">{profile?.display_name ?? session?.displayName}</div>
            <a
              className="at"
              href={`https://instagram.com/${(profile?.instagram ?? handle).replace(/^@+/, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              @{profile?.instagram ?? handle}
            </a>
            <div className="profile-meta">
              {nomeDaCidade(profile?.city) ? (
                <span className="tag">{nomeDaCidade(profile?.city)}</span>
              ) : null}
              {profile?.age ? <span className="tag">{profile.age} anos</span> : null}
              {profile?.profession ? <span className="tag">{profile.profession}</span> : null}
            </div>
          </div>
          {!editing && (
            <button className="btn btn-sm" onClick={() => setEditing(true)} disabled={!isSupabaseConfigured}>
              Editar perfil
            </button>
          )}
        </div>

        {!editing && (
          <div className={`profile-bio${profile?.bio ? "" : " empty"}`}>
            {profile?.bio || "Sem bio ainda. Conte um pouco sobre você."}
          </div>
        )}

        {msg && (
          <div className="muted" style={{ color: "var(--cyan, #5eead4)", marginTop: "0.9rem" }}>
            {msg}
          </div>
        )}
      </div>

      {editing && (
        <div className="card">
          <div className="card-title">Editar perfil</div>
          <div className="stack">
            <div className="form-grid">
              <div className="field">
                <label>Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>@ do Instagram</label>
                <input value={profile?.instagram ?? handle} disabled />
                <span className="hint">É o seu login — só a administração altera.</span>
              </div>
              <div className="field">
                <label>Cidade</label>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Não informar</option>
                  {CIDADES.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <span className="hint">É por ela que te encontram na Rede.</span>
              </div>
              <div className="field">
                <label>Idade</label>
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="opcional" />
              </div>
              <div className="field">
                <label>Profissão</label>
                <input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="opcional"
                />
              </div>
            </div>
            <div className="field">
              <label>Bio</label>
              <textarea
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Fale um pouco sobre você…"
                style={{ width: "100%", resize: "vertical" }}
              />
              <span className="hint">{bio.length}/500</span>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="row" style={{ gap: "0.5rem" }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Conta</div>
        <div className="row between" style={{ flexWrap: "wrap", gap: "0.6rem" }}>
          <div className="muted">Trocar a senha de acesso.</div>
          <Link className="btn btn-sm" href="/conta">
            Segurança da conta
          </Link>
        </div>
      </div>
    </div>
  );
}
