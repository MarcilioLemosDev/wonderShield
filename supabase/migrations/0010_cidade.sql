-- Cidade no perfil: é o que organiza a Rede. O encontro presencial é o ponto —
-- então a lista de pessoas se filtra por onde cada um está.
alter table public.profiles
  add column if not exists city text;

create index if not exists profiles_city_idx on public.profiles (city);
