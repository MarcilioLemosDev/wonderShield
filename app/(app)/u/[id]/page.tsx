"use client";

// Perfil de um membro da rede, aberto ao clicar no nome no bate-papo.
// Só membros logados enxergam (a RLS de profiles exige is_member()).
// Ninguém aparece pelo @ nem pelo nome real: só o nome estelar, o signo e o que
// a pessoa quis contar. O resto se descobre no encontro.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { nomeDaCidade } from "@/lib/cidades";
import { nomeDoSigno, simboloDoSigno, nomeDoRelacionamento } from "@/lib/estelar";
import Denunciar from "@/components/Denunciar";
import Avatar from "@/components/Avatar";

type Profile = {
  id: string;
  display_name: string;
  sign: string | null;
  relationship: string | null;
  age: number | null;
  profession: string | null;
  city: string | null;
  bio: string | null;
  created_at: string;
};

export default function PerfilPublicoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [meuId, setMeuId] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [erroDm, setErroDm] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !params?.id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, sign, relationship, age, profession, bio, city, created_at")
        .eq("id", params.id)
        .single();
      if (!active) return;
      if (error) setError("Perfil não encontrado.");
      else setProfile(data as Profile);
      const { data: sess } = await supabase.auth.getSession();
      if (active) setMeuId(sess.session?.user.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, [params?.id]);

  const mandarMensagem = async () => {
    if (!profile) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setErroDm("");
    setAbrindo(true);
    const { data, error } = await supabase.rpc("abrir_dm", { p_outro: profile.id });
    setAbrindo(false);
    if (error || !data) {
      setErroDm("Não deu para abrir a conversa agora.");
      return;
    }
    router.push(`/dm?t=${data}`);
  };

  if (!isSupabaseConfigured) {
    return <div className="card muted">Indisponível em modo mock.</div>;
  }
  if (error) {
    return (
      <div className="stack">
        <div className="card auth-error">{error}</div>
        <button className="btn btn-sm" onClick={() => router.back()}>
          Voltar
        </button>
      </div>
    );
  }
  if (!profile) return <div className="card muted">Carregando…</div>;

  return (
    <div className="stack">
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => router.back()}>
        ← Voltar
      </button>

      <div className="card">
        <div className="profile-head">
          <Avatar nome={profile.display_name} seed={profile.id} sign={profile.sign} />
          <div className="profile-id">
            <div className="name">{profile.display_name}</div>
            <div className="at">
              {simboloDoSigno(profile.sign)} {nomeDoSigno(profile.sign) ?? "signo reservado"}
            </div>
            <div className="profile-meta">
              {nomeDaCidade(profile.city) ? (
                <span className="tag">{nomeDaCidade(profile.city)}</span>
              ) : null}
              {profile.age ? <span className="tag">{profile.age} anos</span> : null}
              {profile.profession ? <span className="tag">{profile.profession}</span> : null}
              {nomeDoRelacionamento(profile.relationship) ? (
                <span className="tag">{nomeDoRelacionamento(profile.relationship)}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`profile-bio${profile.bio ? "" : " empty"}`}>
          {profile.bio || "Sem bio ainda."}
        </div>

        {meuId && meuId !== profile.id && (
          <div className="perfil-acoes">
            <button className="btn btn-primary" onClick={mandarMensagem} disabled={abrindo}>
              {abrindo ? "Abrindo…" : "Mandar mensagem"}
            </button>
            <Denunciar
              alvoTipo="perfil"
              alvoId={profile.id}
              alvoAutor={profile.id}
              trecho={profile.display_name}
              variante="botao"
            />
            {erroDm && <span className="auth-error" style={{ margin: 0 }}>{erroDm}</span>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Quem é essa pessoa?</div>
        <div className="muted">
          Você não vai descobrir por aqui. Nomes de verdade, rostos e @ só aparecem quando vocês se
          encontram — é esse o jogo. Apareça num encontro em{" "}
          {nomeDaCidade(profile.city) ?? "alguma cidade"} e descubra.
        </div>
      </div>
    </div>
  );
}
