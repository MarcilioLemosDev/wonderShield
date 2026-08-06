// O emblema de cada estelar: nada de rosto. A partir de uma semente estável (o
// id, ou o nome quando não há id) sai sempre o mesmo par de cores — um brasão
// pessoal, reconhecível de longe sem revelar quem é. Determinístico e puro: sem
// upload, sem Storage, sem foto. É o anonimato virando estética.

export function emblemaDe(seed: string): { fundo: string; hue: number } {
  const s = seed || "estelar";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  const hue2 = (hue + 42) % 360;
  return {
    hue,
    fundo: `linear-gradient(140deg, hsl(${hue} 72% 60%), hsl(${hue2} 66% 46%))`,
  };
}
