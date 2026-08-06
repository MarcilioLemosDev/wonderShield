"use client";

// Lupa na topbar: leva à busca global (pessoas, tribos, posts).
import Link from "next/link";

export default function AtalhoBusca() {
  return (
    <Link href="/buscar" className="sino dm-atalho" aria-label="Buscar" title="Buscar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </Link>
  );
}
