"use client";

// Quantas coisas esperam decisão do administrador. Serve ao contador do menu:
// sem ele, só se descobre que alguém aplicou abrindo o painel.
import { useCallback, useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase";

export function usePendencias(ehAdmin: boolean): number {
  const [total, setTotal] = useState(0);

  const contar = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [a, p] = await Promise.all([
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("password_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    setTotal((a.count ?? 0) + (p.count ?? 0));
  }, []);

  useEffect(() => {
    if (!ehAdmin) return;
    const supabase = getSupabase();
    if (!supabase) return;

    void contar();

    // Alguém aplicou ou pediu senha agora: o número muda sem recarregar.
    const canal = supabase
      .channel("pendencias-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        void contar();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "password_requests" }, () => {
        void contar();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [ehAdmin, contar]);

  return ehAdmin ? total : 0;
}
