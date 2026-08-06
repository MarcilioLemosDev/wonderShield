import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireAdmin, generatePassword } from "@/lib/supabaseAdmin";
import { handleToEmail, sanitizeHandle } from "@/lib/handle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/users/:id — ações administrativas sobre um usuário:
// reset de senha, mudança de papel e edição dos dados do perfil.
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

  if (body.action === "reset_password") {
    const password = String(body.password ?? "").trim() || generatePassword();
    if (password.length < 8) {
      return NextResponse.json({ error: "A senha precisa de ao menos 8 caracteres." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // senha entregue por DM é sempre provisória
    await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
    return NextResponse.json({ ok: true, password });
  }

  // Presença na rede. Uma conta de comando pode ficar fora da vista para que
  // quem administra viva o wonderblue por uma conta comum.
  if (body.action === "set_hidden") {
    const hidden = body.hidden === true;
    const { error } = await admin.from("profiles").update({ hidden }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, hidden });
  }

  // Suspensão. A conta suspensa some da vista dos outros e o banco recusa toda
  // escrita dela. Um admin não se suspende, nem suspende outro admin (para não
  // travar a governança por engano).
  if (body.action === "set_banned") {
    const banned = body.banned === true;
    if (id === check.userId) {
      return NextResponse.json({ error: "Você não pode suspender a própria conta." }, { status: 400 });
    }
    if (banned) {
      const { data: alvo } = await admin.from("profiles").select("role").eq("id", id).single();
      if (alvo?.role === "admin") {
        return NextResponse.json({ error: "Rebaixe o administrador antes de suspender." }, { status: 400 });
      }
    }
    const { error } = await admin.from("profiles").update({ banned }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, banned });
  }

  if (body.action === "set_role") {
    const role = body.role === "admin" ? "admin" : "member";
    // Guarda: não deixar a rede ficar sem nenhum administrador.
    if (role === "member") {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "A rede precisa de ao menos um administrador." },
          { status: 400 },
        );
      }
    }
    const { error } = await admin.from("profiles").update({ role }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, role });
  }

  // Troca o @ — ou seja, o próprio login. Atualiza o e-mail interno no Auth e o
  // handle/instagram no perfil, mantendo os dois em sincronia.
  if (body.action === "set_handle") {
    const handle = sanitizeHandle(String(body.handle ?? ""));
    if (handle.length < 2) {
      return NextResponse.json({ error: "@ inválido." }, { status: 400 });
    }
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .neq("id", id)
      .maybeSingle();
    if (taken) return NextResponse.json({ error: `O @${handle} já está em uso.` }, { status: 400 });

    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      email: handleToEmail(handle),
      email_confirm: true,
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

    const { error } = await admin
      .from("profiles")
      .update({ handle, instagram: handle })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, handle });
  }

  if (body.action === "update_profile") {
    const patch: Record<string, unknown> = {};
    if (typeof body.display_name === "string" && body.display_name.trim())
      patch.display_name = body.display_name.trim();
    if (typeof body.profession === "string") patch.profession = body.profession.trim() || null;
    if (typeof body.bio === "string") patch.bio = body.bio.trim() || null;
    if (typeof body.city === "string") patch.city = body.city || null;
    if (typeof body.sign === "string") patch.sign = body.sign || null;
    if (typeof body.real_name === "string" && body.real_name.trim())
      patch.real_name = body.real_name.trim();
    if (body.age !== undefined) {
      const age = body.age === "" || body.age === null ? null : Number(body.age);
      if (age !== null && (!Number.isFinite(age) || age < 13 || age > 120)) {
        return NextResponse.json({ error: "Idade inválida." }, { status: 400 });
      }
      patch.age = age;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
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
