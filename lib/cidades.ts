// Cidades atendidas pela rede. A lista começa curta de propósito: densidade
// local é o que faz um encontro acontecer. Novas entram aqui.
export const CIDADES = [
  { valor: "sao-paulo", nome: "São Paulo" },
  { valor: "campinas", nome: "Campinas" },
] as const;

export type Cidade = (typeof CIDADES)[number]["valor"];

export function nomeDaCidade(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return CIDADES.find((c) => c.valor === valor)?.nome ?? null;
}

export function cidadeValida(valor: unknown): valor is Cidade {
  return typeof valor === "string" && CIDADES.some((c) => c.valor === valor);
}
