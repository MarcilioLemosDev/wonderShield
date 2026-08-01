import Link from "next/link";

import { activity, engagements, profiles } from "@/lib/mock";

export default function HomePage() {
  const active = engagements.filter((e) => e.status === "active").length;
  const online = profiles.filter((p) => p.status === "online").length;

  return (
    <div className="stack">
      <div className="grid grid-stats">
        <div className="card stat">
          <div className="k">Engajamentos ativos</div>
          <div className="v cyan num">{active}</div>
          <div className="d">consentimento na janela</div>
        </div>
        <div className="card stat">
          <div className="k">Blues na rede</div>
          <div className="v num">{profiles.length}</div>
          <div className="d">{online} online agora</div>
        </div>
        <div className="card stat">
          <div className="k">Incursões · arena</div>
          <div className="v num">128</div>
          <div className="d">treino esta semana</div>
        </div>
        <div className="card stat">
          <div className="k">Sua reputação</div>
          <div className="v num">740</div>
          <div className="d">+40 nos últimos 7 dias</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="card">
          <div className="card-title">Ações rápidas</div>
          <div className="stack">
            <Link className="btn btn-primary btn-block" href="/engagements/new">
              Novo engajamento
            </Link>
            <Link className="btn btn-block" href="/arena">
              Entrar na arena
            </Link>
            <Link className="btn btn-block" href="/network">
              Ver a rede
            </Link>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Atividade recente</div>
          <div className="stack" style={{ gap: "0.7rem" }}>
            {activity.map((a, i) => (
              <div key={i} className="row">
                <span className="tag">{a.tag}</span>
                <span className="muted" style={{ fontSize: "12px" }}>
                  {a.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
