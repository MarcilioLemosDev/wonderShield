"use client";

// Havia dois lugares para a pessoa se editar — aqui e em /perfil —, e a barra
// lateral levava a um enquanto o menu levava ao outro. Tudo passou a viver no
// perfil; este endereço só encaminha, para não quebrar links guardados.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/perfil");
  }, [router]);

  return <div className="muted">Levando ao seu perfil…</div>;
}
