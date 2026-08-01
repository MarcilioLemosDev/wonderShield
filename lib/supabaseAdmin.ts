// Cliente Supabase com service_role — SÓ no servidor. Nunca importe isto em
// componentes de cliente: a service_role key ignora RLS e controla o banco
// inteiro. Usado apenas pelas rotas em app/api/admin/*.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { handleToEmail, sanitizeHandle } from "@/lib/handle";
import { cidadeValida } from "@/lib/cidades";
import { signoValido } from "@/lib/estelar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

// Autoriza uma requisição: exige um token de sessão válido cujo dono seja
// admin (role='admin' em public.profiles). Defesa no servidor, independente da UI.
export async function requireAdmin(request: Request): Promise<AdminCheck> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Gestão de usuários indisponível: falta SUPABASE_SERVICE_ROLE_KEY no servidor.",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Sem token de sessão." };

  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData.user) {
    return { ok: false, status: 401, error: "Sessão inválida ou expirada." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return { ok: false, status: 403, error: "Acesso restrito a administradores." };
  }

  return { ok: true, userId: userData.user.id };
}

// Senha forte aleatória (para quando o admin não informar uma).
export function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export type NewMember = {
  name: string; // nome real — fica com a administração
  starName: string; // nome estelar — é assim que a rede o conhece
  sign: string;
  instagram: string;
  age?: number | null;
  profession?: string | null;
  city?: string | null;
  role?: string;
  password?: string;
};

export type CreateResult =
  | { ok: true; id: string; handle: string; password: string }
  | { ok: false; error: string };

// Cria um usuário no modelo sem e-mail: o @ do Instagram vira o nick (handle) e
// um e-mail interno invisível. A senha é gerada se não vier — o admin a repassa
// por DM.
//
// Ninguém entra pela metade: nome, @, idade, profissão e cidade são exigidos
// aqui, na única porta por onde membros nascem (criação manual e aprovação de
// candidatura). Assim não há como surgir alguém sem cidade, que ficaria fora da
// Rede sem aparecer para ninguém.
export async function createMember(admin: SupabaseClient, m: NewMember): Promise<CreateResult> {
  const handle = sanitizeHandle(m.instagram);
  if (!handle) return { ok: false, error: "Informe o @ do Instagram." };

  const nome = (m.name ?? "").trim();
  if (nome.length < 2) return { ok: false, error: "Informe o nome real." };

  // O nome estelar é a identidade pública — sem ele a pessoa entraria exposta.
  const estelar = (m.starName ?? "").trim();
  if (estelar.length < 2) return { ok: false, error: "Dê um nome estelar." };

  if (!signoValido(m.sign)) return { ok: false, error: "Escolha o signo." };

  // Dois membros com o mesmo nome estelar tornariam o jogo impossível.
  const { data: jaExiste } = await admin
    .from("profiles")
    .select("id")
    .ilike("display_name", estelar)
    .maybeSingle();
  if (jaExiste) return { ok: false, error: `Já existe alguém chamado ${estelar}.` };

  const idade = m.age == null ? null : Number(m.age);
  if (idade === null || !Number.isFinite(idade) || idade < 13 || idade > 120) {
    return { ok: false, error: "Informe uma idade válida (13 a 120)." };
  }

  const profissao = (m.profession ?? "").trim();
  if (profissao.length < 2) return { ok: false, error: "Informe a profissão." };

  if (!cidadeValida(m.city)) return { ok: false, error: "Escolha a cidade." };

  const igClean = (m.instagram ?? "").trim().replace(/^@+/, "");
  const role = m.role === "admin" ? "admin" : "member";
  const password = (m.password ?? "").trim() || generatePassword();
  if (password.length < 8) return { ok: false, error: "A senha precisa de ao menos 8 caracteres." };

  const { data, error } = await admin.auth.admin.createUser({
    email: handleToEmail(handle),
    password,
    email_confirm: true,
    user_metadata: { display_name: estelar, handle, role },
  });
  if (error) return { ok: false, error: error.message };

  const uid = data.user?.id;
  if (uid) {
    // O trigger cria o perfil; completamos os campos sociais e reforçamos o papel.
    await admin
      .from("profiles")
      .update({
        display_name: estelar,
        real_name: nome,
        sign: m.sign,
        instagram: igClean,
        age: idade,
        profession: profissao,
        city: m.city,
        role,
        // a senha vai por DM: nasce provisória e precisa ser trocada na entrada
        must_change_password: true,
      })
      .eq("id", uid);
  }

  return { ok: true, id: uid as string, handle, password };
}
