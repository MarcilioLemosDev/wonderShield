import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin, generatePassword } from "@/lib/supabaseAdmin";
import { handleToEmail } from "@/lib/handle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/password-requests/:id — ações sobre um pedido de senha.
//  - action "resolve": reseta a senha do usuário (achado pelo @) e marca concluído.
//  - action "dismiss": apenas marca concluído (ex.: pedido inválido).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { data: req, error: reqErr } = await admin
    .from("password_requests")
    .select("id, identifier, status")
    .eq("id", id)
    .single();
  if (reqErr || !req) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const markDone = () =>
    admin
      .from("password_requests")
      .update({ status: "done", handled_at: new Date().toISOString(), handled_by: check.userId })
      .eq("id", id);

  if (body.action === "dismiss") {
    await markDone();
    return NextResponse.json({ ok: true, status: "done" });
  }

  if (body.action === "resolve") {
    // Acha o usuário pelo @ (via e-mail interno).
    const email = handleToEmail(req.identifier);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) {
      return NextResponse.json(
        { error: `Nenhum usuário com @${req.identifier}. Confira o @ e resete manualmente na lista.` },
        { status: 404 },
      );
    }
    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await markDone();
    return NextResponse.json({ ok: true, status: "done", handle: req.identifier, password });
  }

  return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
}
