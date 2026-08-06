-- ============================================================================
-- Sprint 2 · Reações & Comentários
--
-- Reagir e comentar são atos de membro visível: a conta invisível não participa
-- (como no chat e no feed). A visibilidade de reação/comentário segue a do post
-- — se você não pode ver o post da tribo, não vê o engajamento dele.
-- ============================================================================

-- Um post é visível para mim? (geral/cidade = sim; tribo = só se eu pertenço)
create or replace function public.post_visivel(p_post uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and (p.scope not like 'tribo:%' or public.na_tribo(substring(p.scope from 7)::uuid))
  )
$$;
grant execute on function public.post_visivel(uuid) to authenticated;

-- ---- reações ----
-- Uma por pessoa por post (pode trocar o tipo). Tipos: like, love, haha, wow,
-- sad, grr.
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  pessoa     uuid not null references public.profiles(id) on delete cascade,
  tipo       text not null default 'like'
             check (tipo in ('like','love','haha','wow','sad','grr')),
  created_at timestamptz not null default now(),
  primary key (post_id, pessoa)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions
  for select using (public.is_member() and public.post_visivel(post_id));

drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions
  for insert with check (pessoa = auth.uid() and public.is_member() and public.post_visivel(post_id));

drop policy if exists post_reactions_update on public.post_reactions;
create policy post_reactions_update on public.post_reactions
  for update using (pessoa = auth.uid());

drop policy if exists post_reactions_delete on public.post_reactions;
create policy post_reactions_delete on public.post_reactions
  for delete using (pessoa = auth.uid());

drop trigger if exists post_reactions_bloqueia_invisivel on public.post_reactions;
create trigger post_reactions_bloqueia_invisivel
  before insert on public.post_reactions
  for each row execute function public.bloqueia_conta_invisivel();

-- ---- comentários ----
create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  parent_id   uuid references public.post_comments(id) on delete cascade,
  author      uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select using (public.is_member() and public.post_visivel(post_id));

drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments
  for insert with check (author = auth.uid() and public.is_member() and public.post_visivel(post_id));

drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments
  for delete using (author = auth.uid() or public.is_admin());

-- Selo: autor = auth.uid(), nome do perfil (nome estelar).
create or replace function public.selar_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.author := auth.uid(); end if;
  select display_name into new.author_name from public.profiles where id = new.author;
  if new.author_name is null then new.author_name := 'membro'; end if;
  return new;
end; $$;

drop trigger if exists post_comments_selar on public.post_comments;
create trigger post_comments_selar
  before insert on public.post_comments
  for each row execute function public.selar_comentario();

drop trigger if exists post_comments_bloqueia_invisivel on public.post_comments;
create trigger post_comments_bloqueia_invisivel
  before insert on public.post_comments
  for each row execute function public.bloqueia_conta_invisivel();

alter publication supabase_realtime add table public.post_reactions;
alter publication supabase_realtime add table public.post_comments;
