"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { usePendencias } from "@/lib/pendencias";

// Ícones de traço, 18px — desenhados aqui para não puxar biblioteca.
const Icone = {
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.8L3 20.5l1.4-4.1A8.4 8.4 0 0 1 12 3.5a8.4 8.4 0 0 1 9 8Z" />
    </svg>
  ),
  perfil: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  encontros: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  ),
  rede: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6.5v5c0 4.6 3.4 8.9 8 9.5 4.6-.6 8-4.9 8-9.5v-5Z" />
    </svg>
  ),
};

const NAV = [
  { href: "/chat", label: "Bate-papo", ico: Icone.chat },
  { href: "/encontros", label: "Encontros", ico: Icone.encontros },
  { href: "/rede", label: "Rede", ico: Icone.rede },
  { href: "/perfil", label: "Meu perfil", ico: Icone.perfil },
];

// Itens visíveis só para administradores.
const ADMIN_NAV = [{ href: "/admin", label: "Acesso admin", ico: Icone.admin }];

const TITLES: Record<string, string> = {
  "/chat": "Bate-papo",
  "/encontros": "Encontros",
  "/rede": "Rede",
  "/perfil": "Meu perfil",
  "/admin": "Acesso admin",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  // Fecha a gaveta ao trocar de rota.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  const title = Object.entries(TITLES).find(([h]) => path.startsWith(h))?.[1] ?? "Console";
  const initials = (session?.displayName ?? "OP").slice(0, 2).toUpperCase();
  const ehAdmin = session?.role === "admin";
  const nav = ehAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  const pendencias = usePendencias(!!ehAdmin);
  const close = () => setOpen(false);

  return (
    <div className="app">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand wordmark">
          wonder<b>blue</b>
          <span className="sub">
            {session?.role === "admin" ? "administração" : "sua rede"}
          </span>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={close}
              className={path.startsWith(n.href) ? "active" : ""}
            >
              <span className="ico">{n.ico}</span>
              {n.label}
              {n.href === "/admin" && pendencias > 0 && (
                <span className="badge" title="Esperando você">
                  {pendencias}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <Link
          href="/perfil"
          onClick={close}
          className="sidebar-user"
          style={{ textDecoration: "none", color: "inherit" }}
          title="Minha conta"
        >
          <span className="avatar">{initials}</span>
          <div className="who">
            <div className="h">{session?.displayName ?? "Operador"}</div>
            <div className="r">{session?.role ?? "member"}</div>
          </div>
        </Link>
        <button
          className="btn btn-sm btn-danger"
          style={{ marginTop: "0.6rem" }}
          onClick={() => {
            close();
            signOut();
            router.replace("/login");
          }}
        >
          Sair
        </button>
      </aside>

      {/* fundo escuro atrás da gaveta (só aparece no mobile quando aberta) */}
      <div className={`scrim${open ? " show" : ""}`} onClick={close} aria-hidden />

      <div className="main">
        <div className="topbar">
          <button className="hamburger" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
