"use client";

// Fundo estrelado global. Canvas fixo atrás de todo o conteúdo.
import { useEffect, useRef } from "react";

import { initEstrelas } from "@/lib/estrelas";

export default function Estrelas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return initEstrelas(ref.current);
  }, []);

  return <canvas ref={ref} className="estrelas" aria-hidden />;
}
