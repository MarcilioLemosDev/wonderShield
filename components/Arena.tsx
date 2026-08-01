"use client";

import { useEffect, useRef } from "react";

import { drawScene, fitView, makeGlowSet } from "@/lib/arena/renderer";
import type { MapMsg, StateMsg, View } from "@/lib/arena/types";

// O front nao simula nada: conecta ao motor, recebe o mapa uma vez e o estado a
// cada quadro, e desenha (via renderer). Este componente so cuida da conexao, do
// loop de animacao e do HUD.

const WS_URL = process.env.NEXT_PUBLIC_ARENA_WS ?? "ws://localhost:8765";

export default function Arena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const telemRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const glow = makeGlowSet();

    let vw = 0;
    let vh = 0;
    let view: View = { scale: 1, ox: 0, oy: 0 };
    let map: MapMsg | null = null;
    let prev: StateMsg | null = null;
    let cur: StateMsg | null = null;
    let prevT = 0;
    let curT = 0;
    let raf = 0;
    let ws: WebSocket | null = null;
    let closed = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (map) view = fitView(map, vw, vh);
    };
    window.addEventListener("resize", resize);
    resize();

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
          view = fitView(map!, vw, vh);
        } else if (m.type === "state") {
          prev = cur;
          prevT = curT;
          cur = m;
          curT = performance.now();
        }
      };
    };
    connect();

    const updateHud = () => {
      if (!cur) return;
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
    };

    const frame = () => {
      if (map) {
        drawScene(ctx, glow, view, vw, vh, { map, prev, cur, prevT, curT });
        updateHud();
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
