// Cliente Supabase com service_role — SÓ no servidor. Nunca importe isto em
// componentes de cliente: a service_role key ignora RLS e controla o banco
// inteiro. Usado apenas pelas rotas em app/api/admin/*.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { handleToEmail, sanitizeHandle } from "@/lib/handle";

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
  name: string;
  instagram: string;
  age?: number | null;
  profession?: string | null;
  role?: string;
  password?: string;
};

export type CreateResult =
  | { ok: true; id: string; handle: string; password: string }
  | { ok: false; error: string };

// Cria um usuário no modelo sem e-mail: o @ do Instagram vira o nick (handle) e
// um e-mail interno invisível. O perfil recebe os campos sociais. A senha é
// gerada se não vier — o admin a repassa por DM.
export async function createMember(admin: SupabaseClient, m: NewMember): Promise<CreateResult> {
  const handle = sanitizeHandle(m.instagram);
  if (!handle) return { ok: false, error: "Instagram inválido." };

  const igClean = (m.instagram ?? "").trim().replace(/^@+/, "");
  const role = m.role === "admin" ? "admin" : "member";
  const password = (m.password ?? "").trim() || generatePassword();
  if (password.length < 8) return { ok: false, error: "Senha muito curta." };

  const { data, error } = await admin.auth.admin.createUser({
    email: handleToEmail(handle),
    password,
    email_confirm: true,
    user_metadata: { display_name: m.name || handle, handle, instagram: igClean, role },
  });
  if (error) return { ok: false, error: error.message };

  const uid = data.user?.id;
  if (uid) {
    // O trigger cria o perfil; completamos os campos sociais e reforçamos o papel.
    await admin
      .from("profiles")
      .update({
        display_name: m.name || handle,
        instagram: igClean,
        age: m.age ?? null,
        profession: m.profession ?? null,
        role,
      })
      .eq("id", uid);
  }

  return { ok: true, id: uid as string, handle, password };
}
