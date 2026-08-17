// Portão de ambiente — quebra o build de produção sem a configuração do Supabase.
//
// Sem essas chaves, lib/supabase.ts devolve null e o app cai no modo mock, onde
// QUALQUER credencial entra. Isso serve ao preview local; publicado, é uma porta
// destrancada. Então o build falha em vez de publicar a porta aberta.
//
// A checagem vive aqui, e não num script separado, porque o Next carrega os
// arquivos .env ANTES de ler esta configuração — um script rodando antes do
// `next build` não veria o .env.local e reprovaria quem está configurado direito.
//
// Só vale para build de produção. Em `next dev` o mock continua livre: é para
// isso que ele existe.
const OBRIGATORIAS = [
  ["NEXT_PUBLIC_SUPABASE_URL", "URL do projeto Supabase"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "chave anônima, usada pelo navegador"],
  [
    "SUPABASE_SERVICE_ROLE_KEY",
    "chave de serviço (só no servidor) — sem ela /aplicar e a administração respondem 503",
  ],
];

if (process.env.NODE_ENV === "production") {
  const faltando = OBRIGATORIAS.filter(([nome]) => !(process.env[nome] ?? "").trim());

  if (faltando.length > 0) {
    const lista = faltando.map(([nome, para]) => `    ✗ ${nome} — ${para}`).join("\n");
    throw new Error(
      `\n\n  Build interrompido: falta configuração do Supabase.\n\n${lista}\n\n` +
        `  Sem essas variáveis o app publicaria em modo mock, onde qualquer\n` +
        `  credencial entra. Configure-as no ambiente (na Vercel: Settings →\n` +
        `  Environment Variables) e rode de novo.\n\n` +
        `  Para navegar sem backend, use: npm run dev\n`,
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
