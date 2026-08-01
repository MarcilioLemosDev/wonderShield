// Identidade na rede.
//
// O @ do Instagram serve para o administrador conferir que existe uma pessoa
// real por trás — e para nada mais. Dentro do wonderblue ninguém aparece pelo @
// nem pelo nome de batismo: cada um recebe um nome estelar, atribuído na
// admissão. O rosto real só se revela no encontro.

export const SIGNOS = [
  { valor: "aries", nome: "Áries", simbolo: "♈" },
  { valor: "touro", nome: "Touro", simbolo: "♉" },
  { valor: "gemeos", nome: "Gêmeos", simbolo: "♊" },
  { valor: "cancer", nome: "Câncer", simbolo: "♋" },
  { valor: "leao", nome: "Leão", simbolo: "♌" },
  { valor: "virgem", nome: "Virgem", simbolo: "♍" },
  { valor: "libra", nome: "Libra", simbolo: "♎" },
  { valor: "escorpiao", nome: "Escorpião", simbolo: "♏" },
  { valor: "sagitario", nome: "Sagitário", simbolo: "♐" },
  { valor: "capricornio", nome: "Capricórnio", simbolo: "♑" },
  { valor: "aquario", nome: "Aquário", simbolo: "♒" },
  { valor: "peixes", nome: "Peixes", simbolo: "♓" },
] as const;

export type Signo = (typeof SIGNOS)[number]["valor"];

export function signoValido(v: unknown): v is Signo {
  return typeof v === "string" && SIGNOS.some((s) => s.valor === v);
}

export function nomeDoSigno(v: string | null | undefined): string | null {
  if (!v) return null;
  return SIGNOS.find((s) => s.valor === v)?.nome ?? null;
}

export function simboloDoSigno(v: string | null | undefined): string {
  if (!v) return "";
  return SIGNOS.find((s) => s.valor === v)?.simbolo ?? "";
}

// Momento de vida. A rede começa pela amizade real; deixar isso claro desde a
// entrada evita mal-entendido e abre caminho para o que vier depois.
export const RELACIONAMENTOS = [
  { valor: "solteiro", nome: "Solteiro(a)" },
  { valor: "namorando", nome: "Namorando" },
  { valor: "casado", nome: "Casado(a)" },
  { valor: "enrolado", nome: "É complicado" },
  { valor: "reservado", nome: "Prefiro não dizer" },
] as const;

export type Relacionamento = (typeof RELACIONAMENTOS)[number]["valor"];

export function relacionamentoValido(v: unknown): v is Relacionamento {
  return typeof v === "string" && RELACIONAMENTOS.some((r) => r.valor === v);
}

export function nomeDoRelacionamento(v: string | null | undefined): string | null {
  if (!v || v === "reservado") return null;
  return RELACIONAMENTOS.find((r) => r.valor === v)?.nome ?? null;
}

// Estrelas reais, das que se vê a olho nu. O administrador escolhe uma na
// admissão — ou aceita a sugestão.
export const NOMES_ESTELARES = [
  "Antares", "Vega", "Rigel", "Altair", "Sirius", "Betelgeuse", "Capella",
  "Aldebaran", "Deneb", "Spica", "Bellatrix", "Polaris", "Arcturus", "Canopus",
  "Procyon", "Regulus", "Mira", "Alnilam", "Almach", "Castor", "Pollux",
  "Fomalhaut", "Achernar", "Hadar", "Mimosa", "Alnitak", "Saiph", "Alphard",
  "Denebola", "Algol", "Mizar", "Alcor", "Elnath", "Alhena", "Menkar",
  "Sadalsuud", "Rasalhague", "Shaula", "Nunki", "Etamin", "Schedar", "Caph",
  "Izar", "Alkaid", "Dubhe", "Merak", "Phecda", "Megrez", "Thuban", "Kochab",
  "Zubeneschamali", "Gacrux", "Acrux", "Atria", "Peacock", "Alnair", "Diphda",
  "Markab", "Scheat", "Algenib", "Enif", "Sadr", "Albireo", "Tarazed",
] as const;

// Sugere uma estrela ainda livre. Sem repetição: o nome é a identidade.
export function sugerirNomeEstelar(emUso: string[]): string {
  const usados = new Set(emUso.map((n) => (n ?? "").trim().toLowerCase()));
  const livres = NOMES_ESTELARES.filter((n) => !usados.has(n.toLowerCase()));
  const fonte = livres.length > 0 ? livres : NOMES_ESTELARES;
  return fonte[Math.floor(Math.random() * fonte.length)];
}
