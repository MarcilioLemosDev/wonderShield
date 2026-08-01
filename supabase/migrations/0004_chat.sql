-- Bate-papo geral do wonderblue.
--
-- Modelo: uma única sala geral. As mensagens acumulam e a UI "fecha" a sala a
-- cada 12h (janelas 00h–12h e 12h–24h no fuso America/Sao_Paulo), consolidando o
-- bloco anterior no histórico. A partição por janela é derivada do created_at —
-- não há job de movimentação: o histórico é a própria tabela, agrupada por janela.
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index on public.messages (created_at);

alter table public.messages enable row level security;

-- membros leem tudo; cada um só insere em seu próprio nome; admin pode apagar.
create policy messages_select on public.messages
  for select using (public.is_member());
create policy messages_insert on public.messages
  for insert with check (author = auth.uid() and public.is_member());
create policy messages_delete_admin on public.messages
  for delete using (public.is_admin());

-- realtime: novas mensagens chegam via subscription.
alter publication supabase_realtime add table public.messages;
