"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";

const NAV = [{ href: "/chat", label: "Bate-papo", ico: "▣" }];

// Itens visíveis só para administradores.
const ADMIN_NAV = [{ href: "/admin", label: "Acesso admin", ico: "⚙" }];

const TITLES: Record<string, string> = {
  "/chat": "Bate-papo",
  "/admin": "Acesso admin",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();

  const title = Object.entries(TITLES).find(([h]) => path.startsWith(h))?.[1] ?? "Console";
  const initials = (session?.displayName ?? "OP").slice(0, 2).toUpperCase();
  const nav = session?.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand wordmark">
          WONDER<b>BLUE</b>
          <span className="sub">Console</span>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? "active" : ""}>
              <span className="ico">{n.ico}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials}</span>
          <div className="who">
            <div className="h">{session?.displayName ?? "Operador"}</div>
            <div className="r">{session?.role ?? "member"}</div>
          </div>
        </div>
        <button
          className="btn btn-sm btn-danger"
          style={{ marginTop: "0.6rem" }}
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
        >
          Sair
        </button>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="crumb">wonderblue · Console</div>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
