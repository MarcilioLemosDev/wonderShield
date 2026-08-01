"use client";

// Perfil de um membro da rede, aberto ao clicar no nome no bate-papo.
// Só membros logados enxergam (a RLS de profiles exige is_member()).
// O @ leva ao Instagram — o validador de identidade da rede.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Profile = {
  id: string;
  handle: string;
  display_name: string;
  instagram: string | null;
  age: number | null;
  profession: string | null;
  bio: string | null;
  created_at: string;
};

export default function PerfilPublicoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !params?.id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, handle, display_name, instagram, age, profession, bio, created_at")
        .eq("id", params.id)
        .single();
      if (!active) return;
      if (error) setError("Perfil não encontrado.");
      else setProfile(data as Profile);
    })();
    return () => {
      active = false;
    };
  }, [params?.id]);

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

  const initials = (profile.display_name ?? "OP").slice(0, 2).toUpperCase();
  const ig = (profile.instagram ?? profile.handle).replace(/^@+/, "");

  return (
    <div className="stack">
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => router.back()}>
        ← Voltar
      </button>

      <div className="card">
        <div className="profile-head">
          <span className="avatar">{initials}</span>
          <div className="profile-id">
            <div className="name">{profile.display_name}</div>
            <a className="at" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">
              @{ig} ↗
            </a>
            <div className="profile-meta">
              {profile.age ? <span className="tag">{profile.age} anos</span> : null}
              {profile.profession ? <span className="tag">{profile.profession}</span> : null}
              <span className="tag">
                desde {new Date(profile.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        <div className={`profile-bio${profile.bio ? "" : " empty"}`}>
          {profile.bio || "Sem bio ainda."}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Encontrar de verdade</div>
        <div className="muted">
          A conversa aqui é o começo. Chame no direct e marquem algo presencial — é disso que a rede
          vive.
        </div>
        <a
          className="btn btn-primary btn-sm"
          style={{ marginTop: "0.9rem" }}
          href={`https://instagram.com/${ig}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no Instagram
        </a>
      </div>
    </div>
  );
}
