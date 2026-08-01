-- Invisibilidade de verdade.
--
-- A primeira versão escondia o perfil apenas na consulta da tela da Rede — quem
-- chamasse a API sem esse filtro continuava enxergando. Esconder na interface
-- não é esconder.
--
-- Agora a regra vive na policy: um perfil oculto simplesmente não é devolvido
-- para os outros membros. Continuam vendo: o próprio dono (precisa do seu
-- perfil) e a administração (precisa governar).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    public.is_member()
    and (
      not coalesce(hidden, false)
      or id = auth.uid()
      or public.is_admin()
    )
  );
