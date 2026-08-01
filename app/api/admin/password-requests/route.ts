import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/password-requests — lista pedidos de reset (recentes primeiro).
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const { data, error } = await admin
    .from("password_requests")
    .select("id, identifier, note, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data ?? [] });
}
