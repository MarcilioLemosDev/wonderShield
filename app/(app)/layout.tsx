"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import TrocaSenha from "@/components/TrocaSenha";
import { useAuth } from "@/lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  if (!ready || !session) return null;

  // Senha provisória: nada de rede antes de trocar.
  if (session.mustChangePassword) return <TrocaSenha nome={session.displayName} />;

  return <AppShell>{children}</AppShell>;
}
