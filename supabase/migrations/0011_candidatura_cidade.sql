-- Cidade na candidatura: ninguém entra na rede sem cidade, então ela é pedida
-- já na porta. Sem isso, a aprovação criaria um membro invisível na Rede.
alter table public.applications
  add column if not exists city text;
