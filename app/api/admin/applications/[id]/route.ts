import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin, createMember } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/applications/:id — aprova (cria o usuário) ou recusa.
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

  const { data: app, error: appErr } = await admin
    .from("applications")
    .select("id, name, instagram, age, profession, city, sign, star_name, status")
    .eq("id", id)
    .single();
  if (appErr || !app) return NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 });
  if (app.status !== "pending")
    return NextResponse.json({ error: "Candidatura já foi tratada." }, { status: 400 });

  if (body.action === "reject") {
    await admin
      .from("applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: check.userId })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Batiza sem aprovar: o administrador escolhe o nome estelar e guarda, para
  // decidir depois com calma.
  if (body.action === "set_star_name") {
    const star = String(body.star_name ?? "").trim();
    if (star.length < 2) return NextResponse.json({ error: "Nome estelar inválido." }, { status: 400 });
    const { error } = await admin.from("applications").update({ star_name: star }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, star_name: star });
  }

  if (body.action === "approve") {
    // O nome estelar pode vir agora, no ato de aprovar, ou já ter sido guardado.
    const estelar = String(body.star_name ?? "").trim() || app.star_name || "";
    const result = await createMember(admin, {
      name: app.name,
      starName: estelar,
      sign: app.sign,
      instagram: app.instagram,
      age: app.age,
      profession: app.profession,
      city: app.city,
      role: "member",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    await admin
      .from("applications")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: check.userId,
        created_user: result.id,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, status: "approved", handle: result.handle, password: result.password });
  }

  return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
}
