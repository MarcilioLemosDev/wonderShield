-- ============================================================================
-- Sprint 1 · Feed & Posts
--
-- O post é o oposto da mensagem de chat: permanente, não some na janela de 12h.
-- Mantém a mesma noção de escopo do bate-papo — 'geral', a cidade, ou
-- 'tribo:<id>' — para o feed herdar a estrutura que a rede já conhece.
--
-- A identidade continua sendo o nome estelar: o autor é sempre auth.uid() e o
-- nome exibido é lido do perfil (selo), nunca do cliente.
-- ============================================================================
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  scope       text not null default 'geral',
  body        text not null check (char_length(body) between 1 and 5000),
  edited      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists posts_scope_created_idx on public.posts (scope, created_at desc);
create index if not exists posts_author_idx on public.posts (author);

alter table public.posts enable row level security;

-- Ler: membro; post de tribo exige pertencer. Geral e cidade, todos os membros.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select using (
    public.is_member()
    and (scope not like 'tribo:%' or public.na_tribo(substring(scope from 7)::uuid))
  );

-- Publicar: em nome próprio; tribo exige pertencer.
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (
    author = auth.uid()
    and public.is_member()
    and (scope not like 'tribo:%' or public.na_tribo(substring(scope from 7)::uuid))
  );

-- Editar: só o autor. Apagar: autor ou administração.
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update using (author = auth.uid());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete using (author = auth.uid() or public.is_admin());

-- Selo: autor = auth.uid(), nome do perfil (nome estelar).
create or replace function public.selar_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.author := auth.uid(); end if;
  select display_name into new.author_name from public.profiles where id = new.author;
  if new.author_name is null then new.author_name := 'membro'; end if;
  return new;
end; $$;

drop trigger if exists posts_selar on public.posts;
create trigger posts_selar
  before insert on public.posts
  for each row execute function public.selar_post();

-- A conta invisível não publica (reusa a guarda de 0019).
drop trigger if exists posts_bloqueia_invisivel on public.posts;
create trigger posts_bloqueia_invisivel
  before insert on public.posts
  for each row execute function public.bloqueia_conta_invisivel();

-- Marca "editado" quando o corpo muda.
create or replace function public.marca_post_editado()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then new.edited := true; end if;
  return new;
end; $$;

drop trigger if exists posts_editado on public.posts;
create trigger posts_editado
  before update on public.posts
  for each row execute function public.marca_post_editado();

alter publication supabase_realtime add table public.posts;
