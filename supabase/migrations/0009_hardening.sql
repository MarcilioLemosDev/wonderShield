-- ============================================================================
-- Blindagem do wonderblue
--
-- Três frentes:
--  1. Impedir personificação no bate-papo (o nome do autor vinha do cliente).
--  2. Esconder quem é administrador dos demais membros.
--  3. Evitar enxurrada de candidaturas repetidas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Personificação
--
-- A policy de insert garantia apenas author = auth.uid(); author_name vinha do
-- navegador e podia ser qualquer coisa — dava para assinar com o nome de outra
-- pessoa. O mesmo valia para a citação (reply_*), que permitia forjar uma frase
-- na boca de alguém. Agora o servidor reescreve esses campos: o nome sai do
-- perfil e a citação sai da mensagem original de verdade.
-- ----------------------------------------------------------------------------
create or replace function public.selar_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  orig public.messages;
begin
  -- o autor é sempre quem está autenticado (quando há sessão)
  if auth.uid() is not null then
    new.author := auth.uid();
  end if;

  -- o nome exibido vem do perfil, nunca do cliente
  select display_name into new.author_name from public.profiles where id = new.author;
  if new.author_name is null then
    new.author_name := 'membro';
  end if;

  -- a citação é reconstruída a partir da mensagem realmente referenciada
  if new.reply_to is not null then
    select * into orig from public.messages where id = new.reply_to;
    if found then
      new.reply_author_name := orig.author_name;
      new.reply_excerpt := left(orig.body, 140);
    else
      new.reply_to := null;
      new.reply_author_name := null;
      new.reply_excerpt := null;
    end if;
  else
    new.reply_author_name := null;
    new.reply_excerpt := null;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_selar on public.messages;
create trigger messages_selar
  before insert on public.messages
  for each row execute function public.selar_mensagem();

-- Mensagem não se edita: sem UPDATE, ninguém reescreve o que já foi dito.
drop policy if exists messages_update_none on public.messages;

-- ----------------------------------------------------------------------------
-- 2. Quem é administrador não aparece
--
-- profiles é legível por todos os membros — e trazia a coluna role. Bastava uma
-- consulta à API para listar os administradores. Revogamos a leitura dessa
-- coluna e devolvemos o próprio papel por uma função dedicada.
-- ----------------------------------------------------------------------------
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'member')
$$;

grant execute on function public.my_role() to authenticated;

-- a leitura das demais colunas segue liberada para membros
revoke select (role) on public.profiles from authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. Candidaturas repetidas
--
-- Uma pessoa só pode ter uma candidatura pendente por vez.
-- ----------------------------------------------------------------------------
create unique index if not exists applications_pendente_unica
  on public.applications (lower(instagram))
  where status = 'pending';
