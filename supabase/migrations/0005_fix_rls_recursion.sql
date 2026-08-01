-- Corrige recursão infinita de RLS na tabela profiles.
--
-- is_member()/is_admin() consultam public.profiles, e a própria policy de SELECT
-- de profiles usa is_member(). Como as funções rodavam como INVOKER, o SELECT
-- interno reaplicava a RLS → recursão ("infinite recursion detected in policy").
-- Efeito: leituras de profiles pela chave anônima (navegador) falhavam, e o app
-- não conseguia saber que o usuário é admin.
--
-- Solução padrão do Supabase: marcar as funções como SECURITY DEFINER (rodam como
-- dono, ignorando a RLS na checagem) com search_path fixo. Sem recursão.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;
