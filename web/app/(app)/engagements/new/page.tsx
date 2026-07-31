"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function NewEngagementPage() {
  const [done, setDone] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(true);
  };

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-title">Engajamento criado</div>
        <p className="muted">
          Registro de consentimento pendente de assinatura do cliente. Enquanto não estiver
          ativo e dentro da janela, o motor recusa qualquer scan contra o alvo.
        </p>
        <div className="row" style={{ marginTop: "1.1rem" }}>
          <Link className="btn btn-primary" href="/engagements">
            Ver engajamentos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={submit} style={{ maxWidth: 640 }}>
      <div className="card-title">Novo engajamento</div>
      <div className="field">
        <label>Cliente</label>
        <input required placeholder="Nome da empresa" />
      </div>
      <div className="field">
        <label>Alvo (host)</label>
        <input required placeholder="app.cliente.com" />
      </div>
      <div className="field">
        <label>Escopo · hosts autorizados</label>
        <input required placeholder="app.cliente.com, api.cliente.com" />
        <span className="hint">Subdomínios do host entram no escopo. Fora disto, o motor recusa.</span>
      </div>
      <div className="row" style={{ gap: "1rem" }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Início da janela</label>
          <input required type="datetime-local" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Fim da janela</label>
          <input required type="datetime-local" />
        </div>
      </div>
      <div className="field">
        <label>Token de consentimento</label>
        <input required placeholder="colocado pelo cliente no servidor dele" />
        <span className="hint">Prova de que o dono do alvo autorizou o teste.</span>
      </div>
      <div className="row" style={{ marginTop: "0.4rem" }}>
        <button className="btn btn-primary" type="submit">
          Criar engajamento
        </button>
        <Link className="btn" href="/engagements">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
