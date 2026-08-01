import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin, generatePassword } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/users — lista os usuários (perfil + e-mail do Auth).
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, handle, display_name, role, reputation, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const users = (profiles ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? "" }));
  return NextResponse.json({ users });
}

// POST /api/admin/users — cria um usuário (e-mail confirmado, senha gerada se
// não informada). O role vem do metadata e é reforçado no perfil.
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const displayName = String(body.display_name ?? "").trim();
  const role = body.role === "admin" ? "admin" : "member";
  const password = String(body.password ?? "").trim() || generatePassword();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa de ao menos 8 caracteres." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...(displayName ? { display_name: displayName } : {}),
      role,
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Garante o role no perfil (o trigger cria a linha; aqui reforçamos o papel).
  if (data.user) {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  return NextResponse.json({ ok: true, id: data.user?.id, email, password });
}
