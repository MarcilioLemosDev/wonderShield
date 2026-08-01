import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/chat — contagem de mensagens guardadas.
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const { count, error } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: count ?? 0 });
}

// DELETE /api/admin/chat — apaga o histórico. Sem "scope", apaga tudo;
// com scope=history, preserva a janela em curso (só o que já foi consolidado).
export async function DELETE(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const scope = new URL(request.url).searchParams.get("scope");

  let query = admin.from("messages").delete();
  if (scope === "history") {
    // Início da janela de 12h em curso (00h/12h no horário de Brasília).
    const now = new Date();
    const sp = new Date(now.getTime() - 3 * 3600_000);
    const startWall = Date.UTC(
      sp.getUTCFullYear(),
      sp.getUTCMonth(),
      sp.getUTCDate(),
      sp.getUTCHours() < 12 ? 0 : 12,
    );
    const start = new Date(startWall + 3 * 3600_000);
    query = query.lt("created_at", start.toISOString());
  } else {
    query = query.not("id", "is", null);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
