-- ============================================================================
-- Encontros
--
-- A razão de a rede existir. Aqui a conversa vira data, hora e endereço: alguém
-- propõe, os outros confirmam presença, e o combinado sai da tela.
-- ============================================================================
create table if not exists public.encontros (
  id         uuid primary key default gen_random_uuid(),
  autor      uuid not null references public.profiles(id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 3 and 120),
  local      text not null check (char_length(local) between 3 and 200),
  detalhes   text check (char_length(detalhes) <= 1000),
  quando     timestamptz not null,
  city       text not null,
  cancelado  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists encontros_cidade_data_idx on public.encontros (city, quando);

-- Presenças: uma por pessoa em cada encontro.
create table if not exists public.presencas (
  encontro_id uuid not null references public.encontros(id) on delete cascade,
  pessoa      uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (encontro_id, pessoa)
);

alter table public.encontros enable row level security;
alter table public.presencas enable row level security;

-- Membros veem todos os encontros; qualquer um pode propor. Quem propôs edita e
-- cancela o seu; administrador cuida de qualquer um.
drop policy if exists encontros_select on public.encontros;
create policy encontros_select on public.encontros
  for select using (public.is_member());

drop policy if exists encontros_insert on public.encontros;
create policy encontros_insert on public.encontros
  for insert with check (autor = auth.uid() and public.is_member());

drop policy if exists encontros_update on public.encontros;
create policy encontros_update on public.encontros
  for update using (autor = auth.uid() or public.is_admin());

drop policy if exists encontros_delete on public.encontros;
create policy encontros_delete on public.encontros
  for delete using (autor = auth.uid() or public.is_admin());

-- Presença é ato pessoal: cada um marca e desmarca a sua; todos enxergam quem vai.
drop policy if exists presencas_select on public.presencas;
create policy presencas_select on public.presencas
  for select using (public.is_member());

drop policy if exists presencas_insert on public.presencas;
create policy presencas_insert on public.presencas
  for insert with check (pessoa = auth.uid() and public.is_member());

drop policy if exists presencas_delete on public.presencas;
create policy presencas_delete on public.presencas
  for delete using (pessoa = auth.uid());

-- O autor é sempre quem está autenticado — não se propõe encontro em nome de
-- outro (mesmo espírito do selo das mensagens).
create or replace function public.selar_encontro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.autor := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists encontros_selar on public.encontros;
create trigger encontros_selar
  before insert on public.encontros
  for each row execute function public.selar_encontro();

alter publication supabase_realtime add table public.encontros;
alter publication supabase_realtime add table public.presencas;
