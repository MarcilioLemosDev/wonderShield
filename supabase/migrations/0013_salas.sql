-- Salas de conversa.
--
-- A rede existe para o encontro presencial, e encontro é local: quem está em
-- Campinas precisa conversar com Campinas. Cada mensagem passa a pertencer a uma
-- sala — 'geral' para a rede toda, ou o identificador da cidade.
--
-- O que já foi dito vai para a sala geral, que era o comportamento até aqui.
alter table public.messages
  add column if not exists room text not null default 'geral';

create index if not exists messages_room_created_idx on public.messages (room, created_at);
