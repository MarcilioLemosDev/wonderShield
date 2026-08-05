"use client";

// Meu perfil. Padrão de rede social, enxuto: avatar, nome, @, chips de
// idade/profissão e bio — com edição inline. A troca de senha fica em
// "Minha conta" (/conta).
import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
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
  const { session, signOut } = useAuth();
  const router = useRouter();
  const sair = () => {
    signOut();
    router.replace("/login");
  };
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

  // troca de senha (antes numa página separada; agora vive aqui, junto do resto
  // do "eu" — ter dois lugares para se editar confundia)
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const salvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenha("");
    if (senha.length < 8) return setErroSenha("A senha precisa de ao menos 8 caracteres.");
    if (senha !== confirma) return setErroSenha("As senhas não conferem.");
    const supabase = getSupabase();
    if (!supabase) return setErroSenha("Backend indisponível.");
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvandoSenha(false);
    if (error) return setErroSenha(error.message);
    setSenha("");
    setConfirma("");
    setTrocandoSenha(false);
    setMsg("Senha alterada.");
  };

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      // handle e instagram foram revogados da tabela (anonimato); o próprio dono
      // os recupera pela função meus_dados(). Os demais campos vêm da tabela.
      const [pub, meus] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, sign, age, profession, bio, city")
          .eq("id", uid)
          .single(),
        supabase.rpc("meus_dados").maybeSingle(),
      ]);
      if (!active || !pub.data) return;
      const meta = (meus.data ?? {}) as { handle?: string; instagram?: string };
      const p = { ...pub.data, handle: meta.handle ?? "", instagram: meta.instagram ?? null } as Profile;
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
    if (!city) return setError("Escolha sua cidade — é por ela que a rede se encontra.");

    setSaving(true);
    // O nome estelar, o @ e o signo são identidade: definidos na admissão e
    // imutáveis pelo membro (o banco também recusa, ver 0019). Aqui só vão os
    // campos que são de fato editáveis por quem é dono da linha.
    const patch = {
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
      {/* o cartão: o objeto que representa a pessoa dentro da rede */}
      <div className="cartao-membro">
        <div className="marca">
          wonder<b style={{ fontWeight: 400, opacity: 0.75 }}>blue</b>
        </div>
        <div className="nome">{profile?.display_name ?? session?.displayName}</div>
        <div className="rodape">
          <span>{nomeDaCidade(profile?.city) ?? "sem cidade"}</span>
          <span>{profile?.profession ?? ""}</span>
        </div>
      </div>

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

        {!editing && profile && !profile.city && (
          <div className="aviso">
            Falta sua <b>cidade</b> — sem ela você não aparece na Rede.{" "}
            <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>
              Definir agora
            </button>
          </div>
        )}

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
                <label>Nome estelar</label>
                <input value={profile?.display_name ?? ""} disabled />
                <span className="hint">Sua identidade na rede — só a administração muda.</span>
              </div>
              <div className="field">
                <label>@ do Instagram</label>
                <input value={profile?.instagram ?? handle} disabled />
                <span className="hint">É o seu login — só a administração altera.</span>
              </div>
              <div className="field">
                <label>Cidade *</label>
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Escolha sua cidade</option>
                  {CIDADES.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <span className="hint">Obrigatório — é por ela que te encontram na Rede.</span>
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
        <div className="card-title">Senha de acesso</div>
        {!trocandoSenha ? (
          <div className="row between" style={{ flexWrap: "wrap", gap: "0.6rem" }}>
            <div className="muted">Sua senha de entrada na rede.</div>
            <button className="btn btn-sm" onClick={() => setTrocandoSenha(true)}>
              Trocar senha
            </button>
          </div>
        ) : (
          <form className="stack" onSubmit={salvarSenha} style={{ maxWidth: 420 }}>
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
            {erroSenha && <div className="auth-error">{erroSenha}</div>}
            <div className="row" style={{ gap: "0.5rem" }}>
              <button className="btn btn-primary" type="submit" disabled={salvandoSenha}>
                {salvandoSenha ? "Salvando..." : "Salvar senha"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setTrocandoSenha(false);
                  setErroSenha("");
                  setSenha("");
                  setConfirma("");
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Sair vive aqui também: no celular a barra lateral não existe, e o
          perfil é onde a mão procura a saída. */}
      <button className="btn btn-danger btn-block sair-mobile" onClick={sair}>
        Sair da conta
      </button>
    </div>
  );
}
