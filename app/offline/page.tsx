// Página mostrada quando o app abre sem conexão (via service worker). Estática e
// autossuficiente — não depende de rede nem de sessão.
export const metadata = { title: "Sem conexão · wonderblue" };

export default function OfflinePage() {
  return (
    <div className="suspensa-tela">
      <div className="card suspensa-card">
        <div className="wordmark" style={{ fontSize: 26 }}>
          wonder<b>blue</b>
        </div>
        <div className="card-title" style={{ marginTop: "1rem" }}>
          Sem conexão
        </div>
        <p style={{ lineHeight: 1.6, color: "var(--ink)" }}>
          Você está offline. Assim que a internet voltar, é só recarregar — a rede te espera.
        </p>
      </div>
    </div>
  );
}
