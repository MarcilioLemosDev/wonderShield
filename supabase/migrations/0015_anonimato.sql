-- ============================================================================
-- Camada de anonimato
--
-- O @ do Instagram valida que existe uma pessoa real por trás — e nada mais.
-- Dentro da rede ninguém aparece pelo @ nem pelo nome de batismo: cada um
-- recebe um nome estelar na admissão, e leva junto o signo. Quem é quem se
-- descobre no encontro, não na tela.
--
-- display_name passa a ser o nome estelar (o que todos veem). O nome real vai
-- para real_name, visível só para a administração.
-- ============================================================================

alter table public.profiles
  add column if not exists real_name    text,
  add column if not exists sign         text,
  add column if not exists relationship text;

alter table public.applications
  add column if not exists sign         text,
  add column if not exists star_name    text,
  add column if not exists relationship text;

-- Preserva o que já existe: o nome atual vira o nome real, e quem ainda não tem
-- nome estelar recebe o handle como marcador temporário até a administração
-- batizar.
update public.profiles
set real_name = display_name
where real_name is null;

-- ----------------------------------------------------------------------------
-- O que os membros podem ler
--
-- Mesmo mecanismo já usado para esconder quem é administrador: revogar a coluna.
-- A administração continua enxergando tudo, porque as rotas do painel usam a
-- service_role, que não passa por RLS.
-- ----------------------------------------------------------------------------
revoke select (instagram, real_name) on public.profiles from authenticated, anon;

-- O handle é o login (derivado do @) — também não deve circular.
revoke select (handle) on public.profiles from authenticated, anon;

-- Cada um precisa saber o próprio @ e o próprio nome real; uma função devolve
-- isso apenas para o dono da linha.
create or replace function public.meus_dados()
returns table (handle text, instagram text, real_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.handle, p.instagram, p.real_name
  from public.profiles p
  where p.id = auth.uid()
$$;

grant execute on function public.meus_dados() to authenticated;
