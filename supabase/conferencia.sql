-- =============================================================================
-- wonderblue — CONFERENCIA do banco
-- Rode a qualquer momento. So le, nao altera nada.
-- Uma consulta unica: o SQL Editor do Supabase mostra apenas o resultado da
-- ultima query, entao tudo vem junto num resultado so.
-- =============================================================================
with checagem as (

  -- 0) A publicacao de realtime existe? (se nao existir, o bloco de realtime
  --    da rodada falha e derruba a transacao inteira)
  select 0 as ordem,
         'publicacao: supabase_realtime' as item,
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime')
              then 'ok' else 'NAO EXISTE' end as situacao

  -- 1) As 8 tabelas novas existem?
  union all
  select 1, 'tabela: ' || t,
         case when to_regclass('public.' || t) is not null then 'ok' else 'FALTOU' end
  from unnest(array['posts','post_reactions','post_comments','notifications',
                    'dm_threads','dm_messages','tribo_pedidos','denuncias']) as t

  -- 2) RLS ligada nelas?
  union all
  select 2, 'rls: ' || t,
         case
           when to_regclass('public.' || t) is null then 'tabela nao existe'
           when (select c.relrowsecurity from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = t) then 'ok'
           else 'DESLIGADA'
         end
  from unnest(array['posts','post_reactions','post_comments','notifications',
                    'dm_threads','dm_messages','tribo_pedidos','denuncias']) as t

  -- 3) As colunas novas entraram?
  union all
  select 3, 'coluna: profiles.banned',
         case when exists (select 1 from information_schema.columns
                           where table_schema='public' and table_name='profiles'
                             and column_name='banned') then 'ok' else 'FALTOU' end
  union all
  select 3, 'coluna: tribos.permite_pedido',
         case when exists (select 1 from information_schema.columns
                           where table_schema='public' and table_name='tribos'
                             and column_name='permite_pedido') then 'ok' else 'FALTOU' end

  -- 4) As funcoes novas existem?
  union all
  select 4, 'funcao: ' || f,
         case when to_regprocedure('public.' || f) is not null then 'ok' else 'FALTOU' end
  from unnest(array[
    'post_visivel(uuid)','na_thread(uuid)','abrir_dm(uuid)','aprovar_pedido(uuid,uuid)',
    'selar_post()','selar_comentario()','selar_denuncia()',
    'notificar_reacao()','notificar_comentario()','toca_thread()','marca_post_editado()'
  ]) as f

  -- 5) A guarda cobre a conta SUSPENSA? (o coracao da moderacao)
  union all
  select 5, 'guarda: bloqueia_conta_invisivel cobre banned',
         case
           when to_regprocedure('public.bloqueia_conta_invisivel()') is null
             then 'FUNCAO NAO EXISTE'
           when pg_get_functiondef(to_regprocedure('public.bloqueia_conta_invisivel()'))
                like '%banned%' then 'ok'
           else 'AINDA SO hidden — a 0025 nao pegou'
         end

  -- 6) As policies reescritas pegaram?
  union all
  select 6, 'policy: posts_insert cobre oficial',
         case when exists (select 1 from pg_policies
                           where schemaname='public' and tablename='posts'
                             and policyname='posts_insert'
                             and with_check like '%oficial%') then 'ok' else 'FALTOU' end
  union all
  select 6, 'policy: profiles_select esconde banned',
         case when exists (select 1 from pg_policies
                           where schemaname='public' and tablename='profiles'
                             and policyname='profiles_select'
                             and qual like '%banned%') then 'ok' else 'FALTOU' end

  -- 7) Realtime publicando as 8?
  union all
  select 7, 'realtime: ' || t,
         case when exists (select 1 from pg_publication_tables
                           where pubname='supabase_realtime' and schemaname='public'
                             and tablename=t) then 'ok' else 'FORA DA PUBLICACAO' end
  from unnest(array['posts','post_reactions','post_comments','notifications',
                    'dm_messages','dm_threads','tribo_pedidos','denuncias']) as t
)

-- Resumo primeiro, depois cada item.
select item, situacao from (
  select -1 as ordem,
         '>>> RESUMO' as item,
         case when count(*) filter (where situacao <> 'ok') = 0
              then 'TUDO OK (' || count(*) || ' checagens)'
              else count(*) filter (where situacao <> 'ok') || ' de ' || count(*)
                   || ' com problema' end as situacao
  from checagem
  union all
  select ordem, item, situacao from checagem
) tudo
order by ordem, item;
