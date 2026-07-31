import { profiles } from "@/lib/mock";

export default function NetworkPage() {
  return (
    <div className="stack">
      <div className="section-head">
        <h2>Rede de Blues</h2>
        <button className="btn btn-sm">Convidar</button>
      </div>
      <div className="grid grid-cards">
        {profiles.map((p) => (
          <div key={p.handle} className="card">
            <div className="row">
              <span className="avatar">{p.name.slice(0, 2).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "var(--ink-hi)" }}>{p.name}</div>
                <div className="muted" style={{ fontSize: "11px", letterSpacing: "0.1em" }}>
                  @{p.handle} · {p.role}
                </div>
              </div>
              <span className={"pill " + (p.status === "online" ? "pill-active" : "pill-completed")}>
                {p.status}
              </span>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.4rem", margin: "0.9rem 0" }}>
              {p.specialties.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
            <div className="row between">
              <span className="muted num" style={{ fontSize: "12px", letterSpacing: "0.14em" }}>
                REP {p.reputation}
              </span>
              <button className="btn btn-sm">Falar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
