import Link from "next/link";

import { engagements, type EngagementStatus } from "@/lib/mock";

const PILL: Record<EngagementStatus, string> = {
  active: "pill-active",
  pending: "pill-pending",
  revoked: "pill-revoked",
  completed: "pill-completed",
};

export default function EngagementsPage() {
  return (
    <div className="stack">
      <div className="section-head">
        <h2>Engajamentos</h2>
        <Link className="btn btn-primary btn-sm" href="/engagements/new">
          Novo engajamento
        </Link>
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Alvo</th>
              <th>Janela</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {engagements.map((e) => (
              <tr key={e.id}>
                <td className="mono-strong">{e.client}</td>
                <td className="num">{e.target}</td>
                <td className="muted num" style={{ fontSize: "12px" }}>
                  {e.windowStart} → {e.windowEnd}
                </td>
                <td>
                  <span className={"pill " + PILL[e.status]}>{e.status}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-sm">Abrir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: "12px" }}>
        O motor só dispara contra o alvo e a janela do engajamento, e recusa fora do escopo.
      </p>
    </div>
  );
}
