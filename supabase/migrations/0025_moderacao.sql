-- ============================================================================
-- Sprint 6 · Moderação — denunciar, fila, banir
--
-- A rede é convidada, mas convite não é imunidade. Três peças:
--   • denunciar — qualquer membro sinaliza um post, comentário ou pessoa;
--   • fila — a administração vê os sinais abertos e decide;
--   • banir — profiles.banned tira a conta do jogo: não escreve em lugar nenhum
--     e some da vista dos outros (como a conta invisível, mas por punição).
-- ============================================================================

-- suspensão da conta
alter table public.profiles
  add column if not exists banned boolean not null default false;

-- O mesmo portão que barra a conta invisível barra a suspensa. Como este gatilho
-- já está em todas as superfícies de escrita (chat, presença, posts, reações,
-- comentários, DM, pedidos de tribo), estender aqui cobre a rede inteira de uma
-- vez.
create or replace function public.bloqueia_conta_invisivel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned) then
    raise exception 'conta suspensa não participa da rede';
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.hidden) then
    raise exception 'conta invisível não participa da rede social';
  end if;
  return new;
end; $$;

-- Some da vista: a conta suspensa deixa de ser devolvida para os outros, igual à
-- invisível. Continuam vendo: o próprio dono (para o app saber que está suspenso)
-- e a administração (para governar).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    public.is_member()
    and (
      (not coalesce(hidden, false) and not coalesce(banned, false))
      or id = auth.uid()
      or public.is_admin()
    )
  );

-- ----------------------------------------------------------------------------
-- Denúncias
--
-- Um sinal levantado por um membro. Guarda um trecho do conteúdo na hora, para a
-- fila ter contexto mesmo se o original for apagado depois.
-- ----------------------------------------------------------------------------
create table if not exists public.denuncias (
  id          uuid primary key default gen_random_uuid(),
  denunciante uuid not null references public.profiles(id) on delete cascade,
  alvo_tipo   text not null check (alvo_tipo in ('post', 'comentario', 'mensagem', 'perfil')),
  alvo_id     uuid,
  alvo_autor  uuid references public.profiles(id) on delete set null,
  trecho      text check (char_length(trecho) <= 300),
  motivo      text check (char_length(motivo) <= 500),
  status      text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create index if not exists denuncias_status_idx on public.denuncias (status, created_at);

alter table public.denuncias enable row level security;

-- Só a administração lê e decide. Denunciar é um ato reservado: nem o denunciado
-- nem os outros veem quem sinalizou o quê.
drop policy if exists denuncias_select on public.denuncias;
create policy denuncias_select on public.denuncias
  for select using (public.is_admin());

drop policy if exists denuncias_insert on public.denuncias;
create policy denuncias_insert on public.denuncias
  for insert with check (denunciante = auth.uid() and public.is_member());

drop policy if exists denuncias_update on public.denuncias;
create policy denuncias_update on public.denuncias
  for update using (public.is_admin());

drop policy if exists denuncias_delete on public.denuncias;
create policy denuncias_delete on public.denuncias
  for delete using (public.is_admin());

-- Sela o denunciante e o estado inicial: ninguém abre denúncia em nome de outro
-- nem entra já "resolvida". Conta suspensa/invisível nem denuncia.
create or replace function public.selar_denuncia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.denunciante := auth.uid();
  new.status      := 'aberta';
  new.created_at  := now();
  new.resolved_at := null;
  new.resolved_by := null;
  return new;
end; $$;

drop trigger if exists denuncias_selar on public.denuncias;
create trigger denuncias_selar
  before insert on public.denuncias
  for each row execute function public.selar_denuncia();

drop trigger if exists denuncias_bloqueia_invisivel on public.denuncias;
create trigger denuncias_bloqueia_invisivel
  before insert on public.denuncias
  for each row execute function public.bloqueia_conta_invisivel();

alter publication supabase_realtime add table public.denuncias;
