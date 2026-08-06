"use client";

// Ícone de mensagens na topbar: leva ao /dm e mostra quantas conversas têm
// mensagem não-lida. Atualiza em tempo real quando chega DM nova.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getSupabase } from "@/lib/supabase";

export default function AtalhoMensagens() {
  const [naoLidas, setNaoLidas] = useState(0);

  const contar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    // conta threads distintas com mensagem não-lida vinda do outro
    const { data } = await supabase
      .from("dm_messages")
      .select("thread_id")
      .eq("read", false)
      .neq("sender", uid);
    const threads = new Set((data ?? []).map((m) => (m as { thread_id: string }).thread_id));
    setNaoLidas(threads.size);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ativo = true;
    void contar();
    const canal = supabase
      .channel("atalho-dms")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, () => {
        if (ativo) void contar();
      })
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [contar]);

  return (
    <Link href="/dm" className="sino dm-atalho" aria-label="Mensagens" title="Mensagens">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.8L3 20.5l1.4-4.1A8.4 8.4 0 0 1 12 3.5a8.4 8.4 0 0 1 9 8Z" />
      </svg>
      {naoLidas > 0 && <span className="sino-badge">{naoLidas > 9 ? "9+" : naoLidas}</span>}
    </Link>
  );
}
