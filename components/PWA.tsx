"use client";

// Registra o service worker uma vez, no cliente. Só em produção e se o navegador
// suportar — em dev o SW atrapalharia o hot-reload.
import { useEffect } from "react";

export default function PWA() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost") return;
    const registrar = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
  }, []);

  return null;
}
