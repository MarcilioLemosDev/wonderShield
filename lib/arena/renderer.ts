// Desenho da arena no canvas. Sem WebSocket, sem DOM de HUD, sem React: recebe o
// mapa e o estado e pinta. Interpola posicoes entre quadros para o movimento ficar
// suave apesar do estado chegar ~20x/s.
import type { GlowSet, MapMsg, Soldier, StateMsg, View } from "./types";

function makeGlow(hex: string): HTMLCanvasElement {
  const s = 64;
  const c = 32;
  const o = document.createElement("canvas");
  o.width = o.height = s;
  const g = o.getContext("2d")!;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const gg = (n >> 8) & 255;
  const b = n & 255;
  const grad = g.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,.95)");
  grad.addColorStop(0.25, `rgba(${r},${gg},${b},.9)`);
  grad.addColorStop(0.6, `rgba(${r},${gg},${b},.25)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return o;
}

export function makeGlowSet(): GlowSet {
  return { red: makeGlow("#ff2d55"), blue: makeGlow("#38bdf8"), cyan: makeGlow("#5eead4") };
}

export function fitView(map: MapMsg, vw: number, vh: number): View {
  const scale = Math.min(vw / map.w, vh / map.h);
  return { scale, ox: (vw - map.w * scale) / 2, oy: (vh - map.h * scale) / 2 };
}

function lerpById(a: Soldier[] | null, b: Soldier[], t: number): Soldier[] {
  if (!a) return b;
  const byId = new Map(a.map((s) => [s.id, s]));
  return b.map((s) => {
    const p = byId.get(s.id);
    return p ? { ...s, x: p.x + (s.x - p.x) * t, y: p.y + (s.y - p.y) * t } : s;
  });
}

function drawSoldier(
  ctx: CanvasRenderingContext2D,
  glow: GlowSet,
  view: View,
  s: Soldier,
  srad: number,
) {
  const r = srad * view.scale;
  const x = view.ox + s.x * view.scale;
  const y = view.oy + s.y * view.scale;
  const img = s.team === "red" ? glow.red : glow.blue;
  const col = s.team === "red" ? "#ff2d55" : "#38bdf8";
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(img, x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, 6.283);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, r * 0.34);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(s.aim) * r * 1.8, y + Math.sin(s.aim) * r * 1.8);
  ctx.stroke();
  if (s.state === "engage") {
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.4, 0, 6.283);
    ctx.stroke();
  }
  if (s.flash > 0) {
    const bx = x + Math.cos(s.aim) * r * 1.8;
    const by = y + Math.sin(s.aim) * r * 1.8;
    ctx.fillStyle = "rgba(255,240,200,.9)";
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.6, 0, 6.283);
    ctx.fill();
  }
}

export type Frame = {
  map: MapMsg;
  prev: StateMsg | null;
  cur: StateMsg | null;
  prevT: number;
  curT: number;
};

export function drawScene(
  ctx: CanvasRenderingContext2D,
  glow: GlowSet,
  view: View,
  vw: number,
  vh: number,
  frame: Frame,
) {
  const { map, prev, cur, prevT, curT } = frame;
  const sx = (x: number) => view.ox + x * view.scale;
  const sy = (y: number) => view.oy + y * view.scale;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, vw, vh);

  ctx.fillStyle = "#141d2e";
  for (const w of map.walls) {
    ctx.fillRect(sx(w[0]), sy(w[1]), w[2] * view.scale, w[3] * view.scale);
  }

  const cx = sx(map.core.x);
  const cy = sy(map.core.y);
  const cr = map.cell * 1.4 * view.scale;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(glow.cyan, cx - cr * 2, cy - cr * 2, cr * 4, cr * 4);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(94,234,212,.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, 6.283);
  ctx.stroke();
  if (cur && cur.core_cap > 0.01) {
    ctx.strokeStyle = "#ff2d55";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 0.8, -Math.PI / 2, -Math.PI / 2 + 6.283 * cur.core_cap);
    ctx.stroke();
  }

  if (!cur) return;

  const t = curT ? Math.min(1, (performance.now() - curT) / Math.max(16, curT - prevT)) : 0;
  for (const tr of cur.tracers) {
    ctx.strokeStyle = tr.team === "blue" ? "rgba(94,234,212,.9)" : "rgba(255,120,90,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(tr.x1), sy(tr.y1));
    ctx.lineTo(sx(tr.x2), sy(tr.y2));
    ctx.stroke();
  }
  for (const s of lerpById(prev?.blues ?? null, cur.blues, t)) drawSoldier(ctx, glow, view, s, map.srad);
  for (const s of lerpById(prev?.reds ?? null, cur.reds, t)) drawSoldier(ctx, glow, view, s, map.srad);
}
