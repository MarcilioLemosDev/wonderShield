-- =============================================================================
-- wonderblue — CONFERENCIA pos-sprint
-- Rode DEPOIS do wonderblue-sprint-supabase.sql. So le, nao altera nada.
-- Todas as linhas devem sair com "ok".
-- =============================================================================

-- 1) As 8 tabelas novas existem?
select
  'tabela: ' || t as item,
  case when to_regclass('public.' || t) is not null then 'ok' else 'FALTOU' end as situacao
from unnest(array[
  'posts','post_reactions','post_comments','notifications',
  'dm_threads','dm_messages','tribo_pedidos','denuncias'
]) as t;

-- 2) RLS ligada em todas elas?
select
  'rls: ' || c.relname as item,
  case when c.relrowsecurity then 'ok' else 'DESLIGADA' end as situacao
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('posts','post_reactions','post_comments','notifications',
                    'dm_threads','dm_messages','tribo_pedidos','denuncias')
order by c.relname;

-- 3) As colunas novas entraram?
select 'coluna: profiles.banned' as item,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='profiles' and column_name='banned'
       ) then 'ok' else 'FALTOU' end as situacao
union all
select 'coluna: tribos.permite_pedido',
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='tribos' and column_name='permite_pedido'
       ) then 'ok' else 'FALTOU' end;

-- 4) As funcoes novas existem?
select 'funcao: ' || f as item,
       case when to_regprocedure('public.' || f) is not null then 'ok' else 'FALTOU' end as situacao
from unnest(array[
  'post_visivel(uuid)','na_thread(uuid)','abrir_dm(uuid)','aprovar_pedido(uuid,uuid)',
  'selar_post()','selar_comentario()','selar_denuncia()',
  'notificar_reacao()','notificar_comentario()','toca_thread()','marca_post_editado()'
]) as f;

-- 5) A guarda foi estendida para a conta SUSPENSA? (o coracao da moderacao)
select 'guarda: bloqueia_conta_invisivel cobre banned' as item,
       case when pg_get_functiondef(to_regprocedure('public.bloqueia_conta_invisivel()')) like '%banned%'
            then 'ok' else 'AINDA SO hidden — a 0025 nao pegou' end as situacao;

-- 6) O mural oficial esta restrito a administracao?
select 'policy: posts_insert cobre oficial' as item,
       case when exists (
         select 1 from pg_policies
         where schemaname='public' and tablename='posts' and policyname='posts_insert'
           and with_check like '%oficial%'
       ) then 'ok' else 'FALTOU — a 0026 nao pegou' end as situacao;

-- 7) A conta suspensa some da vista dos outros?
select 'policy: profiles_select esconde banned' as item,
       case when exists (
         select 1 from pg_policies
         where schemaname='public' and tablename='profiles' and policyname='profiles_select'
           and qual like '%banned%'
       ) then 'ok' else 'FALTOU' end as situacao;

-- 8) Realtime publicando as 8?
select 'realtime: ' || t as item,
       case when exists (
         select 1 from pg_publication_tables
         where pubname='supabase_realtime' and schemaname='public' and tablename=t
       ) then 'ok' else 'FORA DA PUBLICACAO' end as situacao
from unnest(array[
  'posts','post_reactions','post_comments','notifications',
  'dm_messages','dm_threads','tribo_pedidos','denuncias'
]) as t;
