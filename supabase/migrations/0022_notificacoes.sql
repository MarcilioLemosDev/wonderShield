-- ============================================================================
-- Sprint 3 · Notificações
--
-- A notificação nasce no banco, por trigger: reagiu, comentou, respondeu. Assim
-- não depende do cliente que agiu — vale para qualquer origem. Só o destinatário
-- lê e marca como lida; ninguém insere à mão (as triggers usam security definer).
-- ============================================================================
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

alter publication supabase_realtime add table public.notifications;
