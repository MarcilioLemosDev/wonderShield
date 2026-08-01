-- Membro invisível.
--
-- A conta de administração não precisa ocupar um lugar na rede. Quem administra
-- pode manter uma conta comum para viver o wonderblue como qualquer outro, e
-- deixar a conta de comando fora da vista: sem aparecer na Rede, sem contar nas
-- somas, sem figurar entre as pessoas.
--
-- Não é sigilo de dado — é ausência de presença. Quem some daqui some da lista;
-- o que essa conta escrever no bate-papo continua aparecendo, então a discrição
-- depende também de não falar por ela.
alter table public.profiles
  add column if not exists hidden boolean not null default false;

create index if not exists profiles_hidden_idx on public.profiles (hidden);
