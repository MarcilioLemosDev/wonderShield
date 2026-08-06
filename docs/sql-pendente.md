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

---

## Sprint 2 · Reações & Comentários — `0021_engajamento.sql`

Cria `post_reactions` (uma reação por pessoa/post) e `post_comments` (com
resposta de 1 nível), função `post_visivel()`, RLS, selo de autor e realtime.

> Cole `supabase/migrations/0021_engajamento.sql` inteiro no SQL Editor. Depende
> de `posts` (S1), então rode **depois** da 0020.

---

## Sprint 3 · Notificações — `0022_notificacoes.sql`

Cria `notifications` + triggers que geram a notificação no banco (reagiu,
comentou, respondeu), RLS (só o dono lê/marca) e realtime.

> Cole `supabase/migrations/0022_notificacoes.sql`. Depende de `posts` (0020) e
> `post_comments`/`post_reactions` (0021). Rode **depois** das duas.

---

## Sprint 4 · Mensagens diretas (DM) — `0023_dm.sql`

Cria `dm_threads` (uma conversa por par, ordenada e sem duplicata) e
`dm_messages`, função `na_thread()`, RPC `abrir_dm()` (abre/encontra a conversa),
RLS (só os dois participantes leem/escrevem), bloqueio da conta invisível,
`toca_thread()` (ordena a lista por atividade) e realtime.

> Cole `supabase/migrations/0023_dm.sql` inteiro no SQL Editor. Depende de
> `is_member()` e `bloqueia_conta_invisivel()` — já existentes. Ao final:
> `notify pgrst, 'reload schema';`
