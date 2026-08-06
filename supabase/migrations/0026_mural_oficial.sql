-- ============================================================================
-- Sprint 8 · Acabamento — Mural oficial
--
-- Um escopo especial de post: 'oficial'. Todo membro lê (é o recado da casa),
-- mas só a administração publica. Reaproveita a tabela posts e o feed; muda só
-- a regra de quem pode escrever ali.
-- ============================================================================
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (
    author = auth.uid()
    and public.is_member()
    and (scope not like 'tribo:%' or public.na_tribo(substring(scope from 7)::uuid))
    and (scope <> 'oficial' or public.is_admin())
  );
