-- Senha provisória.
--
-- O acesso é entregue por DM: o administrador cria (ou reseta) e manda a senha
-- pelo direct. Essa senha nasce queimada — um print da conversa é uma conta
-- aberta. A marca abaixo obriga a troca no primeiro acesso; até lá, o app não
-- deixa navegar.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Quem já está dentro não é incomodado: a exigência vale de agora em diante.
