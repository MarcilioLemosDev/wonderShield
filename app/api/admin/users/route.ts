import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin, createMember } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/users — lista os usuários (perfil social; sem e-mail no modelo).
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "backend indisponível" }, { status: 503 });

  const { data, error } = await admin
    .from("profiles")
    .select("id, handle, display_name, role, instagram, age, profession, city, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [] });
}

// POST /api/admin/users — cria um usuário manualmente (login = @ do Instagram).
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

  const ageRaw = body.age;
  const result = await createMember(admin, {
    name: String(body.name ?? "").trim(),
    instagram: String(body.instagram ?? "").trim(),
    age: ageRaw === "" || ageRaw == null ? null : Number(ageRaw),
    profession: String(body.profession ?? "").trim() || null,
    city: typeof body.city === "string" ? body.city : null,
    role: body.role === "admin" ? "admin" : "member",
    password: String(body.password ?? "").trim() || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, handle: result.handle, password: result.password });
}
