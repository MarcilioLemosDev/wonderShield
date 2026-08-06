"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

// Raiz: decide o destino no cliente. Um redirect de servidor numa pagina "vazia"
// pode nao emitir a rota em alguns builds; renderizar de verdade e depois navegar
// e o caminho robusto.
export default function Index() {
  const { session, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(session ? "/feed" : "/login");
  }, [ready, session, router]);

  return <div className="arena-status">Carregando…</div>;
}
