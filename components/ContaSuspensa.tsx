"use client";

// A tela de quem foi suspenso. A conta não some — mas não participa: some da
// vista dos outros e o banco recusa qualquer escrita. Aqui a pessoa vê só isto,
// e a saída.
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

export default function ContaSuspensa({ nome }: { nome: string }) {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <div className="suspensa-tela">
      <div className="card suspensa-card">
        <div className="wordmark" style={{ fontSize: 26 }}>
          wonder<b>blue</b>
        </div>
        <div className="card-title" style={{ marginTop: "1rem" }}>
          Conta suspensa
        </div>
        <p style={{ lineHeight: 1.6, color: "var(--ink)" }}>
          {nome}, seu acesso à rede está suspenso no momento. Você não aparece para os outros membros
          e não consegue publicar, comentar ou conversar.
        </p>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Se acha que houve um engano, procure quem te convidou.
        </p>
        <button
          className="btn btn-sm"
          style={{ marginTop: "0.6rem" }}
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
