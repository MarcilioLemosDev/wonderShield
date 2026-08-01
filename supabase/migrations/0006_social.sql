-- wonderblue social: perfis com Instagram/idade/profissão/bio, candidaturas de
-- entrada e pedidos de reset de senha. Modelo sem e-mail: a identidade é o @ do
-- Instagram; o contato é por DM. Candidaturas e pedidos de senha são gravados
-- pelas rotas de servidor (service_role), então aqui só há policies de admin.

-- perfis: novos campos sociais
alter table public.profiles
  add column if not exists instagram  text,
  add column if not exists age        integer,
  add column if not exists profession text,
  add column if not exists bio        text;

-- candidaturas de entrada
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  instagram    text not null,
  age          integer,
  profession   text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  created_user uuid references public.profiles(id) on delete set null
);
create index if not exists applications_status_idx on public.applications (status, created_at);

alter table public.applications enable row level security;
create policy applications_admin_all on public.applications
  for all using (public.is_admin()) with check (public.is_admin());

-- pedidos de reset de senha (quem esqueceu informa o @; admin reseta e avisa por DM)
create table if not exists public.password_requests (
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,
  note        text,
  status      text not null default 'pending' check (status in ('pending','done')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  uuid references public.profiles(id) on delete set null
);
create index if not exists password_requests_status_idx on public.password_requests (status, created_at);

alter table public.password_requests enable row level security;
create policy password_requests_admin_all on public.password_requests
  for all using (public.is_admin()) with check (public.is_admin());
