"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/home", label: "Home", ico: "▚" },
  { href: "/network", label: "Rede", ico: "◈" },
  { href: "/engagements", label: "Engajamentos", ico: "▤" },
  { href: "/arena", label: "Arena", ico: "◎" },
  { href: "/profile", label: "Perfil", ico: "◐" },
];

const TITLES: Record<string, string> = {
  "/home": "Home",
  "/network": "Rede de Blues",
  "/engagements": "Engajamentos",
  "/profile": "Perfil",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();

  const title = Object.entries(TITLES).find(([h]) => path.startsWith(h))?.[1] ?? "Console";
  const initials = (session?.displayName ?? "OP").slice(0, 2).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand wordmark">
          WONDER<b>SHIELD</b>
          <span className="sub">Console</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
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
            <div className="crumb">WonderShield · Console</div>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
