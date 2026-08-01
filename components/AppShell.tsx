"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/chat", label: "Bate-papo", ico: "▣" },
  { href: "/perfil", label: "Meu perfil", ico: "◐" },
];

// Itens visíveis só para administradores.
const ADMIN_NAV = [{ href: "/admin", label: "Acesso admin", ico: "⚙" }];

const TITLES: Record<string, string> = {
  "/chat": "Bate-papo",
  "/perfil": "Meu perfil",
  "/admin": "Acesso admin",
  "/conta": "Minha conta",
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
  const nav = session?.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;
  const close = () => setOpen(false);

  return (
    <div className="app">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand wordmark">
          WONDER<b>BLUE</b>
          <span className="sub">Console</span>
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
            </Link>
          ))}
        </nav>
        <Link
          href="/conta"
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
          <button
            className="hamburger"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="crumb">wonderblue · Console</div>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
