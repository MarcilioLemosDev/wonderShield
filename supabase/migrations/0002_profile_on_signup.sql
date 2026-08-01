-- Cria automaticamente o perfil quando um usuário nasce no Supabase Auth.
-- Sem isso, um usuário autenticado não teria linha em public.profiles e as RLS
-- (is_member) o tratariam como de fora da rede. handle/display_name/role saem do
-- user_metadata quando existirem; senão, do prefixo do e-mail.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
  v_name   text;
  v_role   text;
begin
  v_handle := coalesce(
    nullif(new.raw_user_meta_data->>'handle', ''),
    split_part(new.email, '@', 1),
    'operador'
  );
  -- garante unicidade do handle (append de sufixo curto se colidir)
  if exists (select 1 from public.profiles p where p.handle = v_handle) then
    v_handle := v_handle || '-' || substr(new.id::text, 1, 4);
  end if;

  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    initcap(v_handle)
  );
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'member');

  insert into public.profiles (id, handle, display_name, role)
  values (new.id, v_handle, v_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
