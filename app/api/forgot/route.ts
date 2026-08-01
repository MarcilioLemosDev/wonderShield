import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/forgot — pedido de reset de senha (sem login). O usuário informa o
// @; o admin reseta e envia a senha provisória por DM. Grava via service_role.
export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim().replace(/^@+/, "");
  const note = String(body.note ?? "").trim() || null;
  if (identifier.length < 2)
    return NextResponse.json({ error: "Informe seu @ do Instagram." }, { status: 400 });

  const { error } = await admin.from("password_requests").insert({ identifier, note });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
