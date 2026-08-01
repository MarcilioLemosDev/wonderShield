-- Resposta a uma mensagem específica no bate-papo.
--
-- Guardamos o id da mensagem respondida (para poder pular até ela quando ainda
-- estiver carregada) e também um trecho denormalizado do autor/corpo. A cópia
-- evita que a citação suma quando a mensagem original for apagada pelo admin ou
-- ficar fora da janela carregada.
alter table public.messages
  add column if not exists reply_to          uuid references public.messages(id) on delete set null,
  add column if not exists reply_author_name text,
  add column if not exists reply_excerpt     text;
