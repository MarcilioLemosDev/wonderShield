-- wonderblue — sprint Supabase: migrations 0020 a 0026, na ordem.
-- Cole tudo e rode uma vez. Roda em transacao: se falhar, nada e aplicado.

do $preflight$
declare
  faltando text := '';
begin
  if to_regprocedure('public.is_member()') is null then
    faltando := faltando || ' is_member()'; end if;
  if to_regprocedure('public.is_admin()') is null then
    faltando := faltando || ' is_admin()'; end if;
  if to_regprocedure('public.na_tribo(uuid)') is null then
    faltando := faltando || ' na_tribo(uuid)'; end if;
  if to_regprocedure('public.manda_na_tribo(uuid)') is null then
    faltando := faltando || ' manda_na_tribo(uuid)'; end if;
  if to_regprocedure('public.bloqueia_conta_invisivel()') is null then
    faltando := faltando || ' bloqueia_conta_invisivel()'; end if;
  if to_regclass('public.profiles') is null then
    faltando := faltando || ' tabela:profiles'; end if;
  if to_regclass('public.tribos') is null then
    faltando := faltando || ' tabela:tribos'; end if;
  if to_regclass('public.tribo_membros') is null then
    faltando := faltando || ' tabela:tribo_membros'; end if;
  if faltando <> '' then
    raise exception 'PRE-VOO FALHOU. Faltam no banco:%. Rode as 0001-0019 antes.', faltando;
  end if;
  raise notice 'PRE-VOO OK';
end
$preflight$;

-- ===== 0020_posts.sql =====

-- Sprint 1 · Feed & Posts
-- O post é o oposto da mensagem de chat: permanente, não some na janela de 12h.
-- Mantém a mesma noção de escopo do bate-papo — 'geral', a cidade, ou
-- 'tribo:<id>' — para o feed herdar a estrutura que a rede já conhece.
-- A identidade continua sendo o nome estelar: o autor é sempre auth.uid() e o
-- nome exibido é lido do perfil (selo), nunca do cliente.
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  scope       text not null default 'geral',
  body        text not null check (char_length(body) between 1 and 5000),
  edited      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists posts_scope_created_idx on public.posts (scope, created_at desc);
create index if not exists posts_author_idx on public.posts (author);

alter table public.posts enable row level security;

-- Ler: membro; post de tribo exige pertencer. Geral e cidade, todos os membros.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select using (
    public.is_member()
    and (scope not like 'tribo:%' or public.na_tribo(substring(scope from 7)::uuid))
  );

-- Publicar: em nome próprio; tribo exige pertencer.
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (
    author = auth.uid()
    and public.is_member()
    and (scope not like 'tribo:%' or public.na_tribo(substring(scope from 7)::uuid))
  );

-- Editar: só o autor. Apagar: autor ou administração.
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update using (author = auth.uid());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete using (author = auth.uid() or public.is_admin());

-- Selo: autor = auth.uid(), nome do perfil (nome estelar).
create or replace function public.selar_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.author := auth.uid(); end if;
  select display_name into new.author_name from public.profiles where id = new.author;
  if new.author_name is null then new.author_name := 'membro'; end if;
  return new;
end; $$;

drop trigger if exists posts_selar on public.posts;
create trigger posts_selar
  before insert on public.posts
  for each row execute function public.selar_post();

-- A conta invisível não publica (reusa a guarda de 0019).
drop trigger if exists posts_bloqueia_invisivel on public.posts;
create trigger posts_bloqueia_invisivel
  before insert on public.posts
  for each row execute function public.bloqueia_conta_invisivel();

-- Marca "editado" quando o corpo muda.
create or replace function public.marca_post_editado()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then new.edited := true; end if;
  return new;
end; $$;

drop trigger if exists posts_editado on public.posts;
create trigger posts_editado
  before update on public.posts
  for each row execute function public.marca_post_editado();


-- ===== 0021_engajamento.sql =====

-- Sprint 2 · Reações & Comentários
-- Reagir e comentar são atos de membro visível: a conta invisível não participa
-- (como no chat e no feed). A visibilidade de reação/comentário segue a do post
-- — se você não pode ver o post da tribo, não vê o engajamento dele.

-- Um post é visível para mim? (geral/cidade = sim; tribo = só se eu pertenço)
create or replace function public.post_visivel(p_post uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and (p.scope not like 'tribo:%' or public.na_tribo(substring(p.scope from 7)::uuid))
  )
$$;
grant execute on function public.post_visivel(uuid) to authenticated;

-- ---- reações ----
-- Uma por pessoa por post (pode trocar o tipo). Tipos: like, love, haha, wow,
-- sad, grr.
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  pessoa     uuid not null references public.profiles(id) on delete cascade,
  tipo       text not null default 'like'
             check (tipo in ('like','love','haha','wow','sad','grr')),
  created_at timestamptz not null default now(),
  primary key (post_id, pessoa)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions
  for select using (public.is_member() and public.post_visivel(post_id));

drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions
  for insert with check (pessoa = auth.uid() and public.is_member() and public.post_visivel(post_id));

drop policy if exists post_reactions_update on public.post_reactions;
create policy post_reactions_update on public.post_reactions
  for update using (pessoa = auth.uid());

drop policy if exists post_reactions_delete on public.post_reactions;
create policy post_reactions_delete on public.post_reactions
  for delete using (pessoa = auth.uid());

drop trigger if exists post_reactions_bloqueia_invisivel on public.post_reactions;
create trigger post_reactions_bloqueia_invisivel
  before insert on public.post_reactions
  for each row execute function public.bloqueia_conta_invisivel();

-- ---- comentários ----
create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  parent_id   uuid references public.post_comments(id) on delete cascade,
  author      uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select using (public.is_member() and public.post_visivel(post_id));

drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments
  for insert with check (author = auth.uid() and public.is_member() and public.post_visivel(post_id));

drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments
  for delete using (author = auth.uid() or public.is_admin());

-- Selo: autor = auth.uid(), nome do perfil (nome estelar).
create or replace function public.selar_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.author := auth.uid(); end if;
  select display_name into new.author_name from public.profiles where id = new.author;
  if new.author_name is null then new.author_name := 'membro'; end if;
  return new;
end; $$;

drop trigger if exists post_comments_selar on public.post_comments;
create trigger post_comments_selar
  before insert on public.post_comments
  for each row execute function public.selar_comentario();

drop trigger if exists post_comments_bloqueia_invisivel on public.post_comments;
create trigger post_comments_bloqueia_invisivel
  before insert on public.post_comments
  for each row execute function public.bloqueia_conta_invisivel();


-- ===== 0022_notificacoes.sql =====

-- Sprint 3 · Notificações
-- A notificação nasce no banco, por trigger: reagiu, comentou, respondeu. Assim
-- não depende do cliente que agiu — vale para qualquer origem. Só o destinatário
-- lê e marca como lida; ninguém insere à mão (as triggers usam security definer).
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  recipient  uuid not null references public.profiles(id) on delete cascade,
  actor      uuid references public.profiles(id) on delete set null,
  actor_name text,
  tipo       text not null check (tipo in ('reacao','comentario','resposta')),
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  preview    text,
  scope      text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx
  on public.notifications (recipient, read, created_at desc);

alter table public.notifications enable row level security;

-- Cada um só vê, marca lida e apaga as próprias. Não há policy de insert:
-- ninguém cria notificação à mão — só as triggers (security definer).
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (recipient = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (recipient = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (recipient = auth.uid());

-- ---- reação → avisa o dono do post ----
create or replace function public.notificar_reacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dono uuid; v_nome text; v_scope text;
begin
  select author, scope into v_dono, v_scope from public.posts where id = new.post_id;
  if v_dono is null or v_dono = new.pessoa then return new; end if;
  select display_name into v_nome from public.profiles where id = new.pessoa;
  insert into public.notifications (recipient, actor, actor_name, tipo, post_id, preview, scope)
  values (v_dono, new.pessoa, v_nome, 'reacao', new.post_id, new.tipo, v_scope);
  return new;
end; $$;

drop trigger if exists post_reactions_notifica on public.post_reactions;
create trigger post_reactions_notifica
  after insert on public.post_reactions
  for each row execute function public.notificar_reacao();

-- ---- comentário → avisa dono do post e, se for resposta, o dono do pai ----
create or replace function public.notificar_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dono_post uuid; v_dono_pai uuid; v_nome text; v_scope text;
begin
  select author, scope into v_dono_post, v_scope from public.posts where id = new.post_id;
  select display_name into v_nome from public.profiles where id = new.author;

  if v_dono_post is not null and v_dono_post <> new.author then
    insert into public.notifications (recipient, actor, actor_name, tipo, post_id, comment_id, preview, scope)
    values (v_dono_post, new.author, v_nome, 'comentario', new.post_id, new.id, left(new.body, 120), v_scope);
  end if;

  if new.parent_id is not null then
    select author into v_dono_pai from public.post_comments where id = new.parent_id;
    if v_dono_pai is not null and v_dono_pai <> new.author and v_dono_pai <> v_dono_post then
      insert into public.notifications (recipient, actor, actor_name, tipo, post_id, comment_id, preview, scope)
      values (v_dono_pai, new.author, v_nome, 'resposta', new.post_id, new.id, left(new.body, 120), v_scope);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists post_comments_notifica on public.post_comments;
create trigger post_comments_notifica
  after insert on public.post_comments
  for each row execute function public.notificar_comentario();


-- ===== 0023_dm.sql =====

-- Sprint 4 · Mensagens diretas (DM)
-- Conversa reservada entre dois membros, ainda pelo nome estelar. É o canal
-- privado que pode virar o convite para o encontro. Uma thread por par (sem
-- duplicata); só os dois participantes leem e escrevem. Conta invisível não
-- conversa.
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


-- ===== 0024_grupos.sql =====

-- Sprint 5 · Tribos viram grupos
-- A tribo deixa de ser só uma aba de conversa e vira um lugar: tem página,
-- mural (o feed já publica em 'tribo:<id>'), gente à vista e uma porta.
-- A porta é o pedido de entrada. Até aqui só o administrador colocava gente;
-- agora um membro pode **pedir pra entrar**, e quem manda na tribo (admin da
-- rede ou admin da própria tribo) aprova ou recusa. Uma tribo pode fechar a
-- porta (permite_pedido = false) e voltar a ser só por convite.

-- porta da tribo: aberta a pedidos por padrão
alter table public.tribos
  add column if not exists permite_pedido boolean not null default true;

-- Pedidos de entrada. Um por par (não dá pra pedir duas vezes).
create table if not exists public.tribo_pedidos (
  tribo_id   uuid not null references public.tribos(id) on delete cascade,
  pessoa     uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tribo_id, pessoa)
);

create index if not exists tribo_pedidos_tribo_idx on public.tribo_pedidos (tribo_id);

alter table public.tribo_pedidos enable row level security;

-- Quem vê o pedido: quem manda na tribo (para decidir) e quem pediu (para saber
-- que está pendente e poder desistir).
drop policy if exists tribo_pedidos_select on public.tribo_pedidos;
create policy tribo_pedidos_select on public.tribo_pedidos
  for select using (public.manda_na_tribo(tribo_id) or pessoa = auth.uid());

-- Pedir é ato pessoal: só por si mesmo, sendo membro da rede, ainda não estando
-- na tribo, e só se a tribo aceita pedidos.
drop policy if exists tribo_pedidos_insert on public.tribo_pedidos;
create policy tribo_pedidos_insert on public.tribo_pedidos
  for insert with check (
    pessoa = auth.uid()
    and public.is_member()
    and not public.na_tribo(tribo_id)
    and exists (select 1 from public.tribos t where t.id = tribo_id and t.permite_pedido)
  );

-- Apagar o pedido: quem manda na tribo (ao aprovar/recusar) ou quem pediu (ao
-- desistir).
drop policy if exists tribo_pedidos_delete on public.tribo_pedidos;
create policy tribo_pedidos_delete on public.tribo_pedidos
  for delete using (public.manda_na_tribo(tribo_id) or pessoa = auth.uid());

-- conta invisível não pede pra entrar
drop trigger if exists tribo_pedidos_bloqueia_invisivel on public.tribo_pedidos;
create trigger tribo_pedidos_bloqueia_invisivel
  before insert on public.tribo_pedidos
  for each row execute function public.bloqueia_conta_invisivel();

-- Aprovar um pedido: entra na tribo e o pedido some — atômico, e só quem manda
-- na tribo consegue.
create or replace function public.aprovar_pedido(p_tribo uuid, p_pessoa uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.manda_na_tribo(p_tribo) then
    raise exception 'não autorizado';
  end if;
  if not exists (select 1 from public.tribo_pedidos where tribo_id = p_tribo and pessoa = p_pessoa) then
    raise exception 'pedido não encontrado';
  end if;
  insert into public.tribo_membros (tribo_id, pessoa) values (p_tribo, p_pessoa)
    on conflict (tribo_id, pessoa) do nothing;
  delete from public.tribo_pedidos where tribo_id = p_tribo and pessoa = p_pessoa;
end; $$;
grant execute on function public.aprovar_pedido(uuid, uuid) to authenticated;


-- ===== 0025_moderacao.sql =====

-- Sprint 6 · Moderação — denunciar, fila, banir
-- A rede é convidada, mas convite não é imunidade. Três peças:
--   • denunciar — qualquer membro sinaliza um post, comentário ou pessoa;
--   • fila — a administração vê os sinais abertos e decide;
--   • banir — profiles.banned tira a conta do jogo: não escreve em lugar nenhum
--     e some da vista dos outros (como a conta invisível, mas por punição).

-- suspensão da conta
alter table public.profiles
  add column if not exists banned boolean not null default false;

-- O mesmo portão que barra a conta invisível barra a suspensa. Como este gatilho
-- já está em todas as superfícies de escrita (chat, presença, posts, reações,
-- comentários, DM, pedidos de tribo), estender aqui cobre a rede inteira de uma
-- vez.
create or replace function public.bloqueia_conta_invisivel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned) then
    raise exception 'conta suspensa não participa da rede';
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.hidden) then
    raise exception 'conta invisível não participa da rede social';
  end if;
  return new;
end; $$;

-- Some da vista: a conta suspensa deixa de ser devolvida para os outros, igual à
-- invisível. Continuam vendo: o próprio dono (para o app saber que está suspenso)
-- e a administração (para governar).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    public.is_member()
    and (
      (not coalesce(hidden, false) and not coalesce(banned, false))
      or id = auth.uid()
      or public.is_admin()
    )
  );

-- ----------------------------------------------------------------------------
-- Denúncias
-- Um sinal levantado por um membro. Guarda um trecho do conteúdo na hora, para a
-- fila ter contexto mesmo se o original for apagado depois.
-- ----------------------------------------------------------------------------
create table if not exists public.denuncias (
  id          uuid primary key default gen_random_uuid(),
  denunciante uuid not null references public.profiles(id) on delete cascade,
  alvo_tipo   text not null check (alvo_tipo in ('post', 'comentario', 'mensagem', 'perfil')),
  alvo_id     uuid,
  alvo_autor  uuid references public.profiles(id) on delete set null,
  trecho      text check (char_length(trecho) <= 300),
  motivo      text check (char_length(motivo) <= 500),
  status      text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create index if not exists denuncias_status_idx on public.denuncias (status, created_at);

alter table public.denuncias enable row level security;

-- Só a administração lê e decide. Denunciar é um ato reservado: nem o denunciado
-- nem os outros veem quem sinalizou o quê.
drop policy if exists denuncias_select on public.denuncias;
create policy denuncias_select on public.denuncias
  for select using (public.is_admin());

drop policy if exists denuncias_insert on public.denuncias;
create policy denuncias_insert on public.denuncias
  for insert with check (denunciante = auth.uid() and public.is_member());

drop policy if exists denuncias_update on public.denuncias;
create policy denuncias_update on public.denuncias
  for update using (public.is_admin());

drop policy if exists denuncias_delete on public.denuncias;
create policy denuncias_delete on public.denuncias
  for delete using (public.is_admin());

-- Sela o denunciante e o estado inicial: ninguém abre denúncia em nome de outro
-- nem entra já "resolvida". Conta suspensa/invisível nem denuncia.
create or replace function public.selar_denuncia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.denunciante := auth.uid();
  new.status      := 'aberta';
  new.created_at  := now();
  new.resolved_at := null;
  new.resolved_by := null;
  return new;
end; $$;

drop trigger if exists denuncias_selar on public.denuncias;
create trigger denuncias_selar
  before insert on public.denuncias
  for each row execute function public.selar_denuncia();

drop trigger if exists denuncias_bloqueia_invisivel on public.denuncias;
create trigger denuncias_bloqueia_invisivel
  before insert on public.denuncias
  for each row execute function public.bloqueia_conta_invisivel();


-- ===== 0026_mural_oficial.sql =====

-- Sprint 8 · Acabamento — Mural oficial
-- Um escopo especial de post: 'oficial'. Todo membro lê (é o recado da casa),
-- mas só a administração publica. Reaproveita a tabela posts e o feed; muda só
-- a regra de quem pode escrever ali.
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (
    author = auth.uid()
    and public.is_member()
    and (scope not like 'tribo:%' or public.na_tribo(substring(scope from 7)::uuid))
    and (scope <> 'oficial' or public.is_admin())
  );

-- ===== realtime (idempotente: substitui os "alter publication" originais) =====
do $realtime$
declare t text;
begin
  foreach t in array array['posts','post_reactions','post_comments','notifications',
                           'dm_messages','dm_threads','tribo_pedidos','denuncias'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$realtime$;

notify pgrst, 'reload schema';
