-- Apenas para validacao local: no Supabase o schema `auth` ja existe.
-- Recria o minimo (auth.users, auth.uid) para a migracao aplicar num Postgres cru.
create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
