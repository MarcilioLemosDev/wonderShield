# SQL pendente — rodar no Supabase

As migrations abaixo já estão no código (o app as espera), mas **precisam ser
rodadas no SQL Editor** para as funcionalidades acenderem. Conforme combinado,
elas se acumulam aqui para um sprint dedicado de Supabase.

Rode na ordem. Cada bloco é idempotente onde dá.

---

## Sprint 1 · Feed & Posts — `0020_posts.sql`

Cria a tabela `posts` (mural permanente), com escopo geral/cidade/tribo, RLS,
selo de autor (nome estelar) e bloqueio da conta invisível.

> Conteúdo completo em `supabase/migrations/0020_posts.sql`. Cole o arquivo
> inteiro no SQL Editor e rode. Ao final: `notify pgrst, 'reload schema';`

Depende de: `is_member()`, `na_tribo()`, `bloqueia_conta_invisivel()` — já
existentes das rodadas anteriores.
