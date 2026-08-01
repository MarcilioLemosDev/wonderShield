import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin, generatePassword } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/users/:id — ações administrativas sobre um usuário.
// Hoje: reset de senha (gera uma nova se não vier no corpo).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (body.action !== "reset_password") {
    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  }

  const password = String(body.password ?? "").trim() || generatePassword();
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa de ao menos 8 caracteres." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, password });
}

// DELETE /api/admin/users/:id — exclui um usuário do Auth (o perfil cai por
// cascade). Um admin não pode excluir a própria conta.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  if (id === check.userId) {
    return NextResponse.json({ error: "Você não pode excluir a própria conta." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
