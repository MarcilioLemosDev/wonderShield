-- ============================================================================
-- Sprint 5 · Tribos viram grupos
--
-- A tribo deixa de ser só uma aba de conversa e vira um lugar: tem página,
-- mural (o feed já publica em 'tribo:<id>'), gente à vista e uma porta.
--
-- A porta é o pedido de entrada. Até aqui só o administrador colocava gente;
-- agora um membro pode **pedir pra entrar**, e quem manda na tribo (admin da
-- rede ou admin da própria tribo) aprova ou recusa. Uma tribo pode fechar a
-- porta (permite_pedido = false) e voltar a ser só por convite.
-- ============================================================================

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

alter publication supabase_realtime add table public.tribo_pedidos;
