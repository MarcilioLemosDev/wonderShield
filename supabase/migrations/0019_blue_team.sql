-- ============================================================================
-- Blue team · rodada 01
--
-- Responde ao plano de ataque em docs/seguranca/red-team-01.md. O flanco aberto
-- era a autoedição de profiles: a policy deixava o membro editar a própria linha
-- inteira, e a proteção só cobria role/reputation. Fechamos coluna a coluna,
-- damos unicidade ao nome estelar, limitamos texto, calamos a conta invisível e
-- preparamos o rate limit por origem.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- R1 + R2 + R3 · Congelar os campos privilegiados no auto-update
--
-- Um membro comum pode ajustar o que é dele de fato (bio, profissão, idade,
-- cidade); identidade e privilégio são imutáveis por ele. Só a administração
-- (is_admin) e as operações sem sessão (service_role / SQL editor) mudam esses
-- campos. Reescreve a função que o trigger profiles_protect_privileges já chama.
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;   -- service_role / SQL editor
  if public.is_admin() then return new; end if;    -- administração

  -- membro comum editando o próprio perfil: só bio/profissão/idade/cidade passam
  new.role                 := old.role;
  new.reputation           := old.reputation;
  new.hidden               := old.hidden;
  new.must_change_password := old.must_change_password;
  new.handle               := old.handle;
  new.instagram            := old.instagram;
  new.real_name            := old.real_name;
  new.display_name         := old.display_name;
  new.sign                 := old.sign;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- R2 · Nome estelar único no banco (não só na aplicação)
--
-- Se existirem dois display_name iguais hoje, esta criação falha — resolva o
-- duplicado antes (o painel permite renomear). Case-insensitive.
-- ----------------------------------------------------------------------------
create unique index if not exists profiles_display_name_unico
  on public.profiles (lower(display_name));

-- ----------------------------------------------------------------------------
-- R5 · Limites de tamanho nos campos de texto
--
-- NOT VALID: passa a valer para toda inserção/edição daqui em diante sem exigir
-- varredura das linhas antigas (que são curtas de qualquer forma).
-- ----------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_len check (char_length(display_name) <= 40) not valid,
  add constraint profiles_real_name_len    check (real_name is null or char_length(real_name) <= 80) not valid,
  add constraint profiles_profession_len   check (profession is null or char_length(profession) <= 80) not valid,
  add constraint profiles_bio_len          check (bio is null or char_length(bio) <= 500) not valid;

alter table public.applications
  add constraint applications_name_len       check (char_length(name) <= 80) not valid,
  add constraint applications_profession_len check (profession is null or char_length(profession) <= 80) not valid;

-- ----------------------------------------------------------------------------
-- R6 · A conta invisível não participa da rede social
--
-- A invisibilidade tira o perfil da lista, mas mensagem e presença carregam o
-- nome. Em vez de tapar cada vazamento, tornamos a conta invisível o que ela
-- deve ser: só comando. Ela não escreve no bate-papo nem confirma presença.
-- ----------------------------------------------------------------------------
create or replace function public.bloqueia_conta_invisivel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.hidden) then
    raise exception 'conta invisível não participa da rede social';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_bloqueia_invisivel on public.messages;
create trigger messages_bloqueia_invisivel
  before insert on public.messages
  for each row execute function public.bloqueia_conta_invisivel();

drop trigger if exists presencas_bloqueia_invisivel on public.presencas;
create trigger presencas_bloqueia_invisivel
  before insert on public.presencas
  for each row execute function public.bloqueia_conta_invisivel();

-- ----------------------------------------------------------------------------
-- R4 · Rate limit por origem
--
-- Guarda a origem de cada registro público, para o freio contar por IP em vez
-- de globalmente — assim um atacante não nega o funil para todos.
-- ----------------------------------------------------------------------------
alter table public.applications      add column if not exists ip text;
alter table public.password_requests add column if not exists ip text;

create index if not exists applications_ip_idx      on public.applications (ip, created_at);
create index if not exists password_requests_ip_idx on public.password_requests (ip, created_at);
