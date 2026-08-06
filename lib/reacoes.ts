// As reações do feed. Conjunto enxuto, tom da casa: nada de raiva — "força" no
// lugar do "grr" do Facebook.
export const REACOES = [
  { tipo: "like", emoji: "👍", nome: "Curtir" },
  { tipo: "love", emoji: "❤️", nome: "Amei" },
  { tipo: "haha", emoji: "😂", nome: "Haha" },
  { tipo: "wow", emoji: "😮", nome: "Uau" },
  { tipo: "sad", emoji: "😢", nome: "Triste" },
  { tipo: "grr", emoji: "💪", nome: "Força" },
] as const;

export type Reacao = (typeof REACOES)[number]["tipo"];

export function emojiDe(tipo: string): string {
  return REACOES.find((r) => r.tipo === tipo)?.emoji ?? "👍";
}
