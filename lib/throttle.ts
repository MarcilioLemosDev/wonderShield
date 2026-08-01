// Freio para as rotas públicas (/api/apply e /api/forgot). Sem isso, qualquer um
// pode disparar milhares de requisições e encher as filas do administrador.
//
// A contagem é feita no próprio banco: quantos registros a mesma origem criou na
// janela recente. Serverless não guarda estado entre requisições — cada uma pode
// cair numa instância diferente —, então um contador em memória não seguraria
// nada.
//
// Blue team R4: a contagem passou a ser por IP, com um teto global bem mais alto
// só como backstop. Assim um atacante estoura o próprio limite sem negar o funil
// para todos.
import type { SupabaseClient } from "@supabase/supabase-js";

// Melhor esforço para identificar a origem atrás do proxy da Vercel.
export function clientIp(request: Request): string {
  const h = request.headers;
  const fwd = h.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || h.get("x-real-ip") || "desconhecido").trim();
}

type Limite = {
  tabela: "applications" | "password_requests";
  ip: string;
  minutos: number;
  maxPorIp: number; // teto por origem
  maxGlobal: number; // backstop contra distribuído
};

// true = pode seguir; false = excedeu.
export async function dentroDoLimite(
  admin: SupabaseClient,
  { tabela, ip, minutos, maxPorIp, maxGlobal }: Limite,
): Promise<boolean> {
  const desde = new Date(Date.now() - minutos * 60_000).toISOString();

  const [origem, geral] = await Promise.all([
    admin
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", desde),
    admin.from(tabela).select("id", { count: "exact", head: true }).gte("created_at", desde),
  ]);

  // Falha na contagem não deve derrubar o cadastro legítimo.
  if (origem.error || geral.error) return true;
  return (origem.count ?? 0) < maxPorIp && (geral.count ?? 0) < maxGlobal;
}
