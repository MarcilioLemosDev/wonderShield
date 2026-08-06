"use client";

// Estado das notificações do usuário: lista, não-lidas e ações. Realtime: uma
// nova notificação aparece na hora (o sino pulsa).
import { useCallback, useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase";

export type Notificacao = {
  id: string;
  actor_name: string | null;
  tipo: "reacao" | "comentario" | "resposta";
  post_id: string | null;
  preview: string | null;
  scope: string | null;
  read: boolean;
  created_at: string;
};

const CAMPOS = "id, actor_name, tipo, post_id, preview, scope, read, created_at";

export function useNotificacoes() {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregou, setCarregou] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from("notifications")
      .select(CAMPOS)
      .order("created_at", { ascending: false })
      .limit(40);
    setItens((data ?? []) as Notificacao[]);
    setCarregou(true);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    const canalRef: { atual: ReturnType<typeof supabase.channel> | null } = { atual: null };

    void carregar();

    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid || !ativo) return;
      canalRef.atual = supabase
        .channel("minhas-notificacoes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${uid}` },
          (payload) => {
            setItens((prev) => [payload.new as Notificacao, ...prev].slice(0, 40));
          },
        )
        .subscribe();
    })();

    return () => {
      ativo = false;
      if (canalRef.atual) supabase.removeChannel(canalRef.atual);
    };
  }, [carregar]);

  const naoLidas = itens.filter((n) => !n.read).length;

  const marcarTodasLidas = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const idsNaoLidas = itens.filter((n) => !n.read).map((n) => n.id);
    if (idsNaoLidas.length === 0) return;
    setItens((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", idsNaoLidas);
  }, [itens]);

  return { itens, naoLidas, carregou, recarregar: carregar, marcarTodasLidas };
}
