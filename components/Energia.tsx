"use client";

// Barra de energia: preenche conforme a página é percorrida. Fica no topo,
// acima de tudo, e não intercepta cliques.
import { useEffect, useRef } from "react";

export default function Energia() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const atualiza = () => {
      raf = 0;
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const agenda = () => {
      if (!raf) raf = requestAnimationFrame(atualiza);
    };

    atualiza();
    window.addEventListener("scroll", agenda, { passive: true });
    window.addEventListener("resize", agenda);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", agenda);
      window.removeEventListener("resize", agenda);
    };
  }, []);

  return <div ref={ref} className="energia" aria-hidden />;
}
