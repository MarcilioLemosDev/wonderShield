-- Semeia dados e valida authorize_scan nas mesmas situacoes do teste em Python.
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-000000000001', 'op@wondershield.dev');

insert into public.profiles (id, handle, display_name, role)
  values ('00000000-0000-0000-0000-000000000001', 'op', 'Operator', 'member');

-- engajamento ativo, na janela
insert into public.engagements
  (id, owner, client_name, target_host, allowed_hosts, window_start, window_end, status, consent_token)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
   'Cliente A', 'app.cliente.com', array['app.cliente.com'],
   now() - interval '1 hour', now() + interval '1 hour', 'active', 'tok-123');

-- engajamento fora da janela (expirado)
insert into public.engagements
  (id, owner, client_name, target_host, allowed_hosts, window_start, window_end, status, consent_token)
values
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001',
   'Cliente B', 'x.com', array['x.com'],
   now() - interval '2 day', now() - interval '1 day', 'active', 't');

do $$
declare r record;
begin
  select * into r from public.authorize_scan('11111111-1111-1111-1111-111111111111', 'app.cliente.com');
  assert r.ok, 'alvo no escopo e na janela deveria autorizar';

  select * into r from public.authorize_scan('11111111-1111-1111-1111-111111111111', 'api.app.cliente.com');
  assert r.ok, 'subdominio do alvo deveria autorizar';

  select * into r from public.authorize_scan('11111111-1111-1111-1111-111111111111', 'outro.com');
  assert not r.ok and r.reason = 'target out of scope', 'fora de escopo deveria recusar';

  select * into r from public.authorize_scan('11111111-1111-1111-1111-111111111111', 'app.cliente.com.attacker.net');
  assert not r.ok, 'truque de sufixo deveria recusar';

  select * into r from public.authorize_scan('22222222-2222-2222-2222-222222222222', 'x.com');
  assert not r.ok and r.reason like 'outside window%', 'fora da janela deveria recusar';

  raise notice 'TODAS AS CHECAGENS SQL PASSARAM';
end $$;
