/**
 * Campo de estrelas para o fundo de espaço profundo.
 *
 * Portado de marciliolemos.dev (linktree) para o wonderblue. Realismo vem de
 * quatro coisas: distribuição de magnitude (muitas fracas, pouquíssimas
 * brilhantes), cor por classe espectral (azuladas a avermelhadas), brilho
 * difuso somado (composite 'lighter') com espículas de difração nas mais
 * fortes, e paralaxe por profundidade no scroll.
 *
 * Desempenho: cada combinação de cor/tamanho é desenhada uma única vez num
 * sprite fora de tela; o laço por frame só faz drawImage. Respeita
 * prefers-reduced-motion (campo estático, sem cintilar).
 */

interface Estrela {
  x: number;
  y: number;
  s: number; // índice do sprite
  a: number; // brilho base
  tw: number; // velocidade do cintilar
  ph: number; // fase do cintilar
  amp: number; // amplitude do cintilar
  sp: number; // fator de paralaxe
}

/** Cores aproximando classes espectrais reais, com peso de ocorrência. */
const CORES: Array<[string, number]> = [
  ["#a9c2ff", 0.05], // O/B, azul
  ["#d7e2ff", 0.14], // A, branco-azulado
  ["#ffffff", 0.3], // F, branco
  ["#fff6e6", 0.24], // G, branco-amarelado
  ["#ffdfb2", 0.18], // K, laranja
  ["#ffbe96", 0.09], // M, avermelhada
];

/** Raios de núcleo por faixa de magnitude. */
const RAIOS = [0.45, 0.7, 1.0, 1.45, 2.1];

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function sorteiaCor(): number {
  let r = Math.random();
  for (let i = 0; i < CORES.length; i++) {
    r -= CORES[i][1];
    if (r <= 0) return i;
  }
  return 2;
}

/** Desenha o sprite de uma estrela: brilho difuso + espículas + núcleo. */
function fazSprite(hex: string, raio: number, espiculas: boolean): HTMLCanvasElement {
  const halo = raio * 5.5;
  const lado = Math.ceil(halo * 2) + 2;
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const g = c.getContext("2d")!;
  const o = lado / 2;

  // Brilho difuso
  const dif = g.createRadialGradient(o, o, 0, o, o, halo);
  dif.addColorStop(0, rgba(hex, 0.4));
  dif.addColorStop(0.18, rgba(hex, 0.13));
  dif.addColorStop(0.55, rgba(hex, 0.03));
  dif.addColorStop(1, rgba(hex, 0));
  g.fillStyle = dif;
  g.fillRect(0, 0, lado, lado);

  // Espículas de difração (só nas mais brilhantes)
  if (espiculas) {
    g.globalCompositeOperation = "lighter";
    const comp = halo * 1.9;
    const esp = Math.max(0.6, raio * 0.42);
    for (const ang of [0, Math.PI / 2]) {
      g.save();
      g.translate(o, o);
      g.rotate(ang);
      const lin = g.createLinearGradient(-comp, 0, comp, 0);
      lin.addColorStop(0, rgba(hex, 0));
      lin.addColorStop(0.5, rgba(hex, 0.3));
      lin.addColorStop(1, rgba(hex, 0));
      g.fillStyle = lin;
      g.fillRect(-comp, -esp / 2, comp * 2, esp);
      g.restore();
    }
    g.globalCompositeOperation = "source-over";
  }

  // Núcleo
  const nuc = g.createRadialGradient(o, o, 0, o, o, raio);
  nuc.addColorStop(0, "#ffffff");
  nuc.addColorStop(0.4, hex);
  nuc.addColorStop(1, rgba(hex, 0));
  g.fillStyle = nuc;
  g.beginPath();
  g.arc(o, o, raio, 0, 7);
  g.fill();

  return c;
}

/** Liga o campo de estrelas num canvas. Devolve a função de limpeza. */
export function initEstrelas(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const movimento = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Sprites: uma vez por (cor × raio). As duas maiores faixas ganham espículas.
  const sprites: HTMLCanvasElement[] = [];
  for (let c = 0; c < CORES.length; c++) {
    for (let r = 0; r < RAIOS.length; r++) {
      sprites.push(fazSprite(CORES[c][0], RAIOS[r], r >= 3));
    }
  }
  const idSprite = (cor: number, faixa: number) => cor * RAIOS.length + faixa;

  let w = 0;
  let h = 0;
  let estrelas: Estrela[] = [];
  let nebulosa: HTMLCanvasElement | null = null;
  let raf = 0;

  /** Poeira galáctica: manchas amplas e muito fracas, só para dar profundidade. */
  function fazNebulosa(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext("2d")!;
    const manchas: Array<[number, number, number, string]> = [
      [0.22, 0.18, 0.6, "rgba(58, 92, 190, 0.055)"],
      [0.78, 0.32, 0.5, "rgba(120, 70, 190, 0.045)"],
      [0.5, 0.82, 0.7, "rgba(40, 130, 160, 0.04)"],
    ];
    for (const [px, py, pr, cor] of manchas) {
      const x = px * c.width;
      const y = py * c.height;
      const r = pr * Math.max(c.width, c.height);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, cor);
      gr.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, c.width, c.height);
    }
    return c;
  }

  function gera(): void {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Menos estrelas em tela pequena: o custo por pixel é maior no celular.
    const densidade = w < 760 ? 2400 : 1500;
    const n = Math.min(900, Math.max(140, Math.round((w * h) / densidade)));

    estrelas = Array.from({ length: n }, () => {
      // m ~ magnitude: elevado à 4ª faz a maioria ser fraca e pequena.
      const m = Math.pow(Math.random(), 4);
      const faixa = Math.min(RAIOS.length - 1, Math.floor(m * RAIOS.length + Math.random() * 0.4));
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        s: idSprite(sorteiaCor(), faixa),
        a: 0.32 + m * 0.68,
        tw: 0.3 + Math.random() * 1.5,
        ph: Math.random() * Math.PI * 2,
        // estrela fraca cintila mais (cintilação atmosférica)
        amp: 0.08 + (1 - m) * 0.2,
        // maior = mais perto = paralaxe mais rápida
        sp: 0.05 + faixa * 0.11 + Math.random() * 0.06,
      };
    });

    nebulosa = fazNebulosa();
  }

  function desenha(t: number): void {
    const scroll = window.scrollY;
    ctx!.clearRect(0, 0, w, h);

    if (nebulosa) ctx!.drawImage(nebulosa, 0, -scroll * 0.03);

    // Brilho somado: sobreposição de halos acende, como na realidade.
    ctx!.globalCompositeOperation = "lighter";
    for (const e of estrelas) {
      const sp = sprites[e.s];
      const meio = sp.width / 2;
      const y = (((e.y - scroll * e.sp) % h) + h) % h;
      const cint = movimento ? 1 - e.amp + e.amp * Math.sin((t / 1000) * e.tw + e.ph) : 1;
      ctx!.globalAlpha = Math.max(0, Math.min(1, e.a * cint));
      ctx!.drawImage(sp, e.x - meio, y - meio);
    }
    ctx!.globalAlpha = 1;
    ctx!.globalCompositeOperation = "source-over";
  }

  function laco(t: number): void {
    desenha(t);
    raf = requestAnimationFrame(laco);
  }

  function comeca(): void {
    cancelAnimationFrame(raf);
    if (movimento) raf = requestAnimationFrame(laco);
    else desenha(0);
  }

  gera();
  comeca();

  let redim = 0;
  const onResize = () => {
    window.clearTimeout(redim);
    redim = window.setTimeout(() => {
      gera();
      comeca();
    }, 150);
  };
  const onScroll = () => desenha(0);
  const onVis = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else comeca();
  };

  window.addEventListener("resize", onResize);
  // Sem movimento contínuo o campo precisa acompanhar o scroll na mão.
  if (!movimento) window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVis);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(redim);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVis);
  };
}
