"use client";

// Feed. O mural permanente da rede — o contraponto ao chat efêmero de 12h. Um
// post fica. O escopo é o mesmo do bate-papo (Geral · cidade · tribo), para o
// feed herdar a estrutura que a rede já conhece. A identidade é o nome estelar.
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CIDADES, nomeDaCidade } from "@/lib/cidades";
import FeedEscopo from "@/components/FeedEscopo";

function nomeDoEscopo(scope: string, tribos: { id: string; nome: string }[]): string {
  if (scope === "geral") return "Rede toda";
  if (scope.startsWith("tribo:")) {
    return tribos.find((t) => t.id === scope.slice(6))?.nome ?? "Tribo";
  }
  return nomeDaCidade(scope) ?? "Cidade";
}

export default function FeedPage() {
  const { session } = useAuth();
  const [meuId, setMeuId] = useState<string | null>(null);
  const [minhaCidade, setMinhaCidade] = useState<string>("");
  const [tribos, setTribos] = useState<{ id: string; nome: string }[]>([]);
  const [escopo, setEscopo] = useState<string>("geral");

  // Quem sou, minha cidade e minhas tribos — para montar os escopos possíveis.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;
      if (!ativo) return;
      setMeuId(uid);
      if (!uid) return;
      const [perfil, minhasTribos] = await Promise.all([
        supabase.from("profiles").select("city").eq("id", uid).single(),
        supabase.from("tribo_membros").select("tribos(id, nome)").eq("pessoa", uid),
      ]);
      if (!ativo) return;
      if (perfil.data?.city) setMinhaCidade(perfil.data.city);
      const lista = ((minhasTribos.data ?? []) as unknown as {
        tribos: { id: string; nome: string } | { id: string; nome: string }[] | null;
      }[])
        .flatMap((t) => (Array.isArray(t.tribos) ? t.tribos : t.tribos ? [t.tribos] : []))
        .filter((t) => !!t?.id);
      setTribos(lista);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const escopos = useMemo(() => {
    const base = [{ valor: "geral", nome: "Geral" }];
    if (minhaCidade) base.push({ valor: minhaCidade, nome: nomeDaCidade(minhaCidade) ?? "Cidade" });
    // além da minha cidade, deixo escolher qualquer cidade da rede
    for (const c of CIDADES) if (c.valor !== minhaCidade) base.push({ valor: c.valor, nome: c.nome });
    for (const t of tribos) base.push({ valor: `tribo:${t.id}`, nome: t.nome });
    return base;
  }, [minhaCidade, tribos]);

  if (!isSupabaseConfigured) {
    return (
      <div className="card">
        <div className="muted">Feed indisponível em modo mock.</div>
      </div>
    );
  }

  const ehAdmin = session?.role === "admin";

  return (
    <div className="stack">
      {/* escopo */}
      <div className="card">
        <div className="filtros">
          {escopos.map((s) => (
            <button
              key={s.valor}
              className={`chip${escopo === s.valor ? " ativo" : ""}${s.valor.startsWith("tribo:") ? " tribo" : ""}`}
              onClick={() => setEscopo(s.valor)}
            >
              {s.nome}
            </button>
          ))}
        </div>
      </div>

      <FeedEscopo
        key={escopo}
        scope={escopo}
        escopoNome={nomeDoEscopo(escopo, tribos)}
        meuId={meuId}
        meuNome={session?.displayName ?? "membro"}
        ehAdmin={!!ehAdmin}
      />
    </div>
  );
}
