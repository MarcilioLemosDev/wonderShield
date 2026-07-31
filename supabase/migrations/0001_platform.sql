-- WonderShield: schema da plataforma.
--
-- Entrada so por convite. O engajamento e o registro de consentimento que amarra
-- o motor a um alvo e uma janela autorizados. A funcao authorize_scan espelha, no
-- banco, a checagem que o motor faz em Python (engine/consent.py): defesa em
-- profundidade, a regra vale nas duas camadas.

create type public.engagement_status as enum ('pending', 'active', 'revoked', 'completed');

-- perfis: um por usuario autenticado
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null,
  display_name text not null,
  avatar_url   text,
  role         text not null default 'member' check (role in ('member', 'admin')),
  reputation   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- convites: a rede so cresce por convite
create table public.invites (
  code        text primary key,
  invited_by  uuid references public.profiles(id) on delete set null,
  email       text,
  used_by     uuid references public.profiles(id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- engajamentos: o consentimento assinado que autoriza um scan
create table public.engagements (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references public.profiles(id) on delete cascade,
  client_name   text not null,
  target_host   text not null,
  allowed_hosts text[] not null,
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  methods       text[] not null default '{}',
  status        public.engagement_status not null default 'pending',
  consent_token text not null,
  signed_by     text,
  signed_at     timestamptz,
  created_at    timestamptz not null default now(),
  constraint window_valid check (window_end > window_start),
  constraint scope_present check (array_length(allowed_hosts, 1) >= 1)
);

-- execucoes de scan, sempre atreladas a um engajamento
create table public.scan_runs (
  id               uuid primary key default gen_random_uuid(),
  engagement_id    uuid not null references public.engagements(id) on delete cascade,
  operator         uuid not null references public.profiles(id) on delete cascade,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  result           text,
  authorized       boolean not null,
  authorize_reason text
);

create index on public.engagements (owner);
create index on public.scan_runs (engagement_id);

-- ---- consentimento no banco (espelha engine/consent.py) ----
create or replace function public.authorize_scan(p_engagement uuid, p_target text)
returns table (ok boolean, reason text)
language plpgsql
stable
as $$
declare
  e public.engagements;
begin
  select * into e from public.engagements where id = p_engagement;
  if not found then
    return query select false, 'engagement not found'; return;
  end if;
  if e.status <> 'active' then
    return query select false, 'engagement not active'; return;
  end if;
  if now() < e.window_start then
    return query select false, 'outside window: not started'; return;
  end if;
  if now() > e.window_end then
    return query select false, 'outside window: expired'; return;
  end if;
  if not exists (
    select 1 from unnest(e.allowed_hosts) h
    where lower(p_target) = lower(h) or lower(p_target) like '%.' || lower(h)
  ) then
    return query select false, 'target out of scope'; return;
  end if;
  return query select true, 'authorized';
end;
$$;

-- ---- Row Level Security ----
alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.engagements enable row level security;
alter table public.scan_runs   enable row level security;

create or replace function public.is_member() returns boolean
language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

-- diretorio visivel a membros; cada um edita so o proprio perfil
create policy profiles_select on public.profiles
  for select using (public.is_member());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

-- convites: quem convidou ve os seus, admin ve todos, membro cria
create policy invites_select on public.invites
  for select using (invited_by = auth.uid() or public.is_admin());
create policy invites_insert on public.invites
  for insert with check (invited_by = auth.uid() and public.is_member());

-- engajamentos: dono e admin
create policy engagements_select on public.engagements
  for select using (owner = auth.uid() or public.is_admin());
create policy engagements_insert on public.engagements
  for insert with check (owner = auth.uid() and public.is_member());
create policy engagements_update_owner on public.engagements
  for update using (owner = auth.uid());

-- execucoes: operador e admin
create policy scan_runs_select on public.scan_runs
  for select using (operator = auth.uid() or public.is_admin());
create policy scan_runs_insert on public.scan_runs
  for insert with check (operator = auth.uid());
