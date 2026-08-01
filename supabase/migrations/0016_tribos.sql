-- ============================================================================
-- Tribos
--
-- Grupos dentro da rede. O administrador cria a tribo e coloca gente nela; pode
-- também nomear administradores da própria tribo, que passam a adicionar e
-- remover membros sem precisar dele. Cada tribo ganha uma sala de conversa.
-- ============================================================================
create table if not exists public.tribos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 2 and 60),
  descricao  text check (char_length(descricao) <= 300),
  city       text,
  created_at timestamptz not null default now()
);

create table if not exists public.tribo_membros (
  tribo_id   uuid not null references public.tribos(id) on delete cascade,
  pessoa     uuid not null references public.profiles(id) on delete cascade,
  admin      boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tribo_id, pessoa)
);

create index if not exists tribo_membros_pessoa_idx on public.tribo_membros (pessoa);

alter table public.tribos        enable row level security;
alter table public.tribo_membros enable row level security;

-- Quem manda numa tribo: administrador da rede ou administrador daquela tribo.
create or replace function public.manda_na_tribo(p_tribo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.tribo_membros m
    where m.tribo_id = p_tribo and m.pessoa = auth.uid() and m.admin
  )
$$;

grant execute on function public.manda_na_tribo(uuid) to authenticated;

-- Pertencer é o que dá acesso à sala da tribo.
create or replace function public.na_tribo(p_tribo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tribo_membros m
    where m.tribo_id = p_tribo and m.pessoa = auth.uid()
  )
$$;

grant execute on function public.na_tribo(uuid) to authenticated;

-- As tribos são visíveis a todos os membros (dá para saber que existem); só a
-- administração da rede cria e apaga.
drop policy if exists tribos_select on public.tribos;
create policy tribos_select on public.tribos
  for select using (public.is_member());

drop policy if exists tribos_insert on public.tribos;
create policy tribos_insert on public.tribos
  for insert with check (public.is_admin());

drop policy if exists tribos_update on public.tribos;
create policy tribos_update on public.tribos
  for update using (public.manda_na_tribo(id));

drop policy if exists tribos_delete on public.tribos;
create policy tribos_delete on public.tribos
  for delete using (public.is_admin());

-- Composição: quem manda na tribo põe e tira gente; qualquer membro enxerga.
drop policy if exists tribo_membros_select on public.tribo_membros;
create policy tribo_membros_select on public.tribo_membros
  for select using (public.is_member());

drop policy if exists tribo_membros_insert on public.tribo_membros;
create policy tribo_membros_insert on public.tribo_membros
  for insert with check (public.manda_na_tribo(tribo_id));

drop policy if exists tribo_membros_update on public.tribo_membros;
create policy tribo_membros_update on public.tribo_membros
  for update using (public.manda_na_tribo(tribo_id));

drop policy if exists tribo_membros_delete on public.tribo_membros;
create policy tribo_membros_delete on public.tribo_membros
  for delete using (public.manda_na_tribo(tribo_id) or pessoa = auth.uid());

-- ----------------------------------------------------------------------------
-- Sala da tribo
--
-- A sala é 'tribo:<id>'. Conversa de tribo não vaza: só lê e escreve quem
-- pertence. As salas abertas (geral e cidades) seguem como estavam.
-- ----------------------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    public.is_member() and (
      room not like 'tribo:%'
      or public.na_tribo(substring(room from 7)::uuid)
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    author = auth.uid() and public.is_member() and (
      room not like 'tribo:%'
      or public.na_tribo(substring(room from 7)::uuid)
    )
  );

alter publication supabase_realtime add table public.tribos;
alter publication supabase_realtime add table public.tribo_membros;
