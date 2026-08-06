-- ============================================================================
-- Sprint 4 · Mensagens diretas (DM)
--
-- Conversa reservada entre dois membros, ainda pelo nome estelar. É o canal
-- privado que pode virar o convite para o encontro. Uma thread por par (sem
-- duplicata); só os dois participantes leem e escrevem. Conta invisível não
-- conversa.
-- ============================================================================
create table if not exists public.dm_threads (
  id      uuid primary key default gen_random_uuid(),
  user_a  uuid not null references public.profiles(id) on delete cascade,
  user_b  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  constraint dm_par_ordenado check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.dm_threads(id) on delete cascade,
  sender     uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at);

alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;

-- Sou participante desta thread?
create or replace function public.na_thread(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dm_threads t
    where t.id = p_thread and auth.uid() in (t.user_a, t.user_b)
  )
$$;
grant execute on function public.na_thread(uuid) to authenticated;

drop policy if exists dm_threads_select on public.dm_threads;
create policy dm_threads_select on public.dm_threads
  for select using (auth.uid() in (user_a, user_b));

drop policy if exists dm_messages_select on public.dm_messages;
create policy dm_messages_select on public.dm_messages
  for select using (public.na_thread(thread_id));

drop policy if exists dm_messages_insert on public.dm_messages;
create policy dm_messages_insert on public.dm_messages
  for insert with check (sender = auth.uid() and public.na_thread(thread_id));

-- marcar como lida (o destinatário)
drop policy if exists dm_messages_update on public.dm_messages;
create policy dm_messages_update on public.dm_messages
  for update using (public.na_thread(thread_id));

-- conta invisível não escreve DM
drop trigger if exists dm_messages_bloqueia_invisivel on public.dm_messages;
create trigger dm_messages_bloqueia_invisivel
  before insert on public.dm_messages
  for each row execute function public.bloqueia_conta_invisivel();

-- atualiza last_at da thread a cada mensagem (para ordenar a lista)
create or replace function public.toca_thread()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.dm_threads set last_at = now() where id = new.thread_id;
  return new;
end; $$;
drop trigger if exists dm_messages_toca on public.dm_messages;
create trigger dm_messages_toca
  after insert on public.dm_messages
  for each row execute function public.toca_thread();

-- Abre (ou encontra) a conversa com outra pessoa. Ordena o par, cria se não
-- existe, devolve o id. Bloqueia partir de/para conta invisível.
create or replace function public.abrir_dm(p_outro uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu uuid; a uuid; b uuid; tid uuid;
begin
  eu := auth.uid();
  if eu is null or p_outro is null or eu = p_outro then raise exception 'destinatário inválido'; end if;
  if not public.is_member() then raise exception 'não autorizado'; end if;
  if exists (select 1 from public.profiles where id = eu and hidden) then
    raise exception 'conta invisível não inicia conversa';
  end if;
  if not exists (select 1 from public.profiles where id = p_outro and not hidden) then
    raise exception 'destinatário indisponível';
  end if;

  if eu < p_outro then a := eu; b := p_outro; else a := p_outro; b := eu; end if;
  insert into public.dm_threads (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do nothing;
  select id into tid from public.dm_threads where user_a = a and user_b = b;
  return tid;
end; $$;
grant execute on function public.abrir_dm(uuid) to authenticated;

alter publication supabase_realtime add table public.dm_messages;
alter publication supabase_realtime add table public.dm_threads;
