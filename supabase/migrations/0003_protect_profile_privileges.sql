-- Trava de privilégio: impede que um usuário comum altere o próprio papel.
--
-- A policy profiles_update_self permite ao usuário editar a própria linha, o que
-- é desejável para nome/avatar — mas, sem restrição de coluna, ele poderia se
-- autopromover a 'admin' (ou inflar a própria 'reputation'). Este trigger
-- preserva role e reputation em updates feitos pelo próprio dono da linha.
--
-- Quem pode mudar papel/reputação: administradores (public.is_admin()) e
-- operações sem usuário autenticado (SQL Editor / service_role, onde auth.uid()
-- é null e as RLS já não se aplicam).
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / SQL Editor: sem usuário autenticado, libera.
  if auth.uid() is null then
    return new;
  end if;

  -- administradores podem alterar papel/reputação.
  if public.is_admin() then
    return new;
  end if;

  -- usuário comum editando o próprio perfil: campos privilegiados ficam imutáveis.
  new.role := old.role;
  new.reputation := old.reputation;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
