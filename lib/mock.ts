// Dados de exemplo para o front render antes do backend existir. Quando o
// Supabase entrar, estes viram consultas; as telas nao mudam.

export type Profile = {
  handle: string;
  name: string;
  role: string;
  reputation: number;
  specialties: string[];
  status: "online" | "offline";
};

export const profiles: Profile[] = [
  { handle: "v0lt", name: "Vera Nunes", role: "Blue sênior", reputation: 980, specialties: ["Web", "Auth", "Recon"], status: "online" },
  { handle: "ncmb", name: "Nico Amaral", role: "Blue", reputation: 640, specialties: ["API", "Cloud"], status: "online" },
  { handle: "kx7", name: "Karina Sousa", role: "Blue sênior", reputation: 910, specialties: ["Mobile", "Web"], status: "offline" },
  { handle: "br0k3n", name: "Bruno Reis", role: "Blue", reputation: 520, specialties: ["Recon", "OSINT"], status: "online" },
  { handle: "m1st", name: "Marina Teles", role: "Blue", reputation: 705, specialties: ["Web", "SSRF"], status: "offline" },
  { handle: "gh0st", name: "Gustavo Horta", role: "Blue sênior", reputation: 1120, specialties: ["Cloud", "IAM", "API"], status: "online" },
];

export type EngagementStatus = "active" | "pending" | "revoked" | "completed";

export type Engagement = {
  id: string;
  client: string;
  target: string;
  scope: string[];
  windowStart: string;
  windowEnd: string;
  status: EngagementStatus;
};

export const engagements: Engagement[] = [
  { id: "e-1042", client: "Cliente Alfa", target: "app.alfa.com", scope: ["app.alfa.com", "api.alfa.com"], windowStart: "2026-08-02 09:00", windowEnd: "2026-08-02 18:00", status: "active" },
  { id: "e-1039", client: "Beta Digital", target: "portal.beta.io", scope: ["portal.beta.io"], windowStart: "2026-08-05 20:00", windowEnd: "2026-08-06 02:00", status: "pending" },
  { id: "e-1031", client: "Gama Saúde", target: "area.gama.med.br", scope: ["area.gama.med.br"], windowStart: "2026-07-28 08:00", windowEnd: "2026-07-28 12:00", status: "completed" },
  { id: "e-1024", client: "Delta Log", target: "track.deltalog.com", scope: ["track.deltalog.com"], windowStart: "2026-07-20 22:00", windowEnd: "2026-07-21 01:00", status: "revoked" },
];

export const activity: { tag: string; text: string }[] = [
  { tag: "HIT", text: "SQLi confirmado em app.alfa.com (e-1042)" },
  { tag: "REC", text: "gh0st entrou na rede" },
  { tag: "CAP", text: "Arena · incursão 07 rompida no treino" },
  { tag: "SYS", text: "Engajamento e-1039 aguarda assinatura do cliente" },
  { tag: "HLD", text: "Arena · incursão 03 repelida" },
];
