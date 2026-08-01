import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dentroDoLimite } from "@/lib/throttle";
import { cidadeValida } from "@/lib/cidades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/apply — candidatura pública (sem login). Grava via service_role.
export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Cadastro indisponível no momento." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const instagram = String(body.instagram ?? "").trim().replace(/^@+/, "");
  const professionRaw = String(body.profession ?? "").trim();
  const profession = professionRaw || null;
  const ageRaw = body.age;
  const age = ageRaw === "" || ageRaw == null ? null : Number(ageRaw);
  const city = body.city;

  // Tudo obrigatório: quem entra precisa estar completo, senão vira um membro
  // invisível na Rede.
  if (name.length < 2) return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  if (instagram.length < 2)
    return NextResponse.json({ error: "Informe seu @ do Instagram." }, { status: 400 });
  if (age === null || !Number.isFinite(age) || age < 13 || age > 120)
    return NextResponse.json({ error: "Informe uma idade válida." }, { status: 400 });
  if (!profession || profession.length < 2)
    return NextResponse.json({ error: "Informe sua profissão." }, { status: 400 });
  if (!cidadeValida(city))
    return NextResponse.json({ error: "Escolha sua cidade." }, { status: 400 });

  if (!(await dentroDoLimite(admin, { tabela: "applications", minutos: 10, maximo: 20 }))) {
    return NextResponse.json(
      { error: "Muitas candidaturas agora há pouco. Tente de novo em alguns minutos." },
      { status: 429 },
    );
  }

  const { error } = await admin
    .from("applications")
    .insert({ name, instagram, age, profession, city });

  if (error) {
    // índice único: já existe uma candidatura pendente para este @
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe uma candidatura em análise para este @." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
