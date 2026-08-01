// Freio para as rotas públicas (/api/apply e /api/forgot). Sem isso, qualquer um
// pode disparar milhares de requisições e encher as filas do administrador.
//
// A contagem é feita no próprio banco: quantos registros a mesma origem criou na
// janela recente. Não depende de memória do processo — em serverless cada
// requisição pode cair numa instância diferente, então um contador em memória
// não seguraria nada.
import type { SupabaseClient } from "@supabase/supabase-js";

// Melhor esforço para identificar a origem atrás do proxy da Vercel.
export function clientIp(request: Request): string {
  const h = request.headers;
  const fwd = h.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || h.get("x-real-ip") || "desconhecido").trim();
}

type Limite = {
  tabela: "applications" | "password_requests";
  minutos: number;
  maximo: number;
};

// true = pode seguir; false = excedeu o limite.
export async function dentroDoLimite(
  admin: SupabaseClient,
  { tabela, minutos, maximo }: Limite,
): Promise<boolean> {
  const desde = new Date(Date.now() - minutos * 60_000).toISOString();
  const { count, error } = await admin
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .gte("created_at", desde);

  // Falha na contagem não deve derrubar o cadastro legítimo.
  if (error) return true;
  return (count ?? 0) < maximo;
}
