"use client";

import { useEffect, useRef } from "react";

// O front nao simula nada: recebe o mapa uma vez e o estado a cada quadro pelo
// WebSocket, e apenas desenha. A verdade e o motor Python.

type Soldier = {
  id: number;
  team: "red" | "blue";
  x: number;
  y: number;
  aim: number;
  state: string;
  flash: number;
};
type Tracer = { x1: number; y1: number; x2: number; y2: number; team: "red" | "blue" };
type MapMsg = {
  type: "map";
  w: number;
  h: number;
  cell: number;
  srad: number;
  core: { x: number; y: number };
  walls: [number, number, number, number][];
};
type StateMsg = {
  type: "state";
  reds: Soldier[];
  blues: Soldier[];
  tracers: Tracer[];
  time_left: number;
  incursion: number;
  holds: number;
  breaches: number;
};

const WS_URL = process.env.NEXT_PUBLIC_ARENA_WS ?? "ws://localhost:8765";

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

export default function Arena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const telemRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const GLOW = { red: makeGlow("#ff2d55"), blue: makeGlow("#38bdf8"), cyan: makeGlow("#5eead4") };

    let DPR = 1;
    let VW = 0;
    let VH = 0;
    const view = { scale: 1, ox: 0, oy: 0 };
    let map: MapMsg | null = null;
    let prev: StateMsg | null = null;
    let cur: StateMsg | null = null;
    let prevT = 0;
    let curT = 0;
    let raf = 0;
    let ws: WebSocket | null = null;
    let closed = false;

    const fit = () => {
      if (!map) return;
      view.scale = Math.min(VW / map.w, VH / map.h);
      view.ox = (VW - map.w * view.scale) / 2;
      view.oy = (VH - map.h * view.scale) / 2;
    };
    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      VW = window.innerWidth;
      VH = window.innerHeight;
      cv.width = Math.floor(VW * DPR);
      cv.height = Math.floor(VH * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fit();
    };
    window.addEventListener("resize", resize);
    resize();

    const sx = (x: number) => view.ox + x * view.scale;
    const sy = (y: number) => view.oy + y * view.scale;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => { if (statusRef.current) statusRef.current.style.display = "none"; };
      ws.onclose = () => {
        if (closed) return;
        if (statusRef.current) {
          statusRef.current.style.display = "";
          statusRef.current.textContent = "Motor desconectado. Retentando...";
        }
        setTimeout(connect, 1200);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (ev: MessageEvent) => {
        const m = JSON.parse(ev.data as string);
        if (m.type === "map") {
          map = m;
          fit();
        } else if (m.type === "state") {
          prev = cur;
          prevT = curT;
          cur = m;
          curT = performance.now();
        }
      };
    };
    connect();

    const lerpById = (a: Soldier[] | null, b: Soldier[], t: number): Soldier[] => {
      if (!a) return b;
      const byId = new Map(a.map((s) => [s.id, s]));
      return b.map((s) => {
        const p = byId.get(s.id);
        return p ? { ...s, x: p.x + (s.x - p.x) * t, y: p.y + (s.y - p.y) * t } : s;
      });
    };

    const drawSoldier = (s: Soldier, srad: number) => {
      const r = srad * view.scale;
      const x = sx(s.x);
      const y = sy(s.y);
      const img = s.team === "red" ? GLOW.red : GLOW.blue;
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
    };

    const frame = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, VW, VH);
      if (map) {
        ctx.fillStyle = "#141d2e";
        for (const w of map.walls) {
          ctx.fillRect(sx(w[0]), sy(w[1]), w[2] * view.scale, w[3] * view.scale);
        }
        const cx = sx(map.core.x);
        const cy = sy(map.core.y);
        const cr = map.cell * 1.4 * view.scale;
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(GLOW.cyan, cx - cr * 2, cy - cr * 2, cr * 4, cr * 4);
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "rgba(94,234,212,.5)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, 6.283);
        ctx.stroke();

        if (cur) {
          const t = curT ? Math.min(1, (performance.now() - curT) / Math.max(16, curT - prevT)) : 0;
          for (const tr of cur.tracers) {
            ctx.strokeStyle = tr.team === "blue" ? "rgba(94,234,212,.9)" : "rgba(255,120,90,.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx(tr.x1), sy(tr.y1));
            ctx.lineTo(sx(tr.x2), sy(tr.y2));
            ctx.stroke();
          }
          for (const s of lerpById(prev?.blues ?? null, cur.blues, t)) drawSoldier(s, map.srad);
          for (const s of lerpById(prev?.reds ?? null, cur.reds, t)) drawSoldier(s, map.srad);

          const tl = Math.max(0, cur.time_left | 0);
          if (clockRef.current) {
            clockRef.current.textContent = `${(tl / 60) | 0}:${String(tl % 60).padStart(2, "0")}`;
            clockRef.current.className = "t" + (tl <= 15 ? " crit" : "");
          }
          if (telemRef.current) {
            telemRef.current.innerHTML =
              `INCURSION <b>${String(cur.incursion).padStart(2, "0")}</b> · ` +
              `RED <b>${cur.reds.length}</b> · BLUE <b>${cur.blues.length}</b> · ` +
              `HOLDS <b>${cur.holds}</b> · BREACHES <b>${cur.breaches}</b>`;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ws?.close();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="arena-canvas" />
      <div className="hud">
        <div className="hud-top">
          <div>
            <div className="wordmark">
              WONDER<b>SHIELD</b>
            </div>
            <div className="sub">Live Incursion · Arena</div>
          </div>
          <div className="telem" ref={telemRef} />
        </div>
        <div className="clock">
          <div className="t" ref={clockRef}>
            --:--
          </div>
          <div className="l">Time To Objective</div>
        </div>
      </div>
      <div className="arena-status" ref={statusRef}>
        Conectando ao motor...
      </div>
    </>
  );
}
