"use client";

import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { session } = useAuth();
  const initials = (session?.displayName ?? "OP").slice(0, 2).toUpperCase();

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ gap: "1.1rem" }}>
          <span className="avatar" style={{ width: 64, height: 64, fontSize: 20 }}>
            {initials}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, color: "var(--ink-hi)" }}>
              {session?.displayName ?? "Operador"}
            </div>
            <div className="muted" style={{ letterSpacing: "0.1em" }}>
              @{session?.handle ?? "operador"} · {session?.role ?? "member"}
            </div>
          </div>
          <button className="btn btn-sm">Editar</button>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="card stat">
          <div className="k">Reputação</div>
          <div className="v cyan num">740</div>
        </div>
        <div className="card stat">
          <div className="k">Engajamentos</div>
          <div className="v num">12</div>
        </div>
        <div className="card stat">
          <div className="k">Furos pagos</div>
          <div className="v num">37</div>
        </div>
        <div className="card stat">
          <div className="k">Arena · vitórias</div>
          <div className="v num">89</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Especialidades</div>
        <div className="row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
          {["Web", "API", "Cloud", "Auth", "Recon"].map((s) => (
            <span key={s} className="tag">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
