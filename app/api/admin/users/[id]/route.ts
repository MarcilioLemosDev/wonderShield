import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
