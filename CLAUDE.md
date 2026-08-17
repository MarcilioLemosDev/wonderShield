# wonderblue — orientação

Leia isto antes de qualquer coisa. Este arquivo existe porque o README já
descreveu um produto diferente do que está no ar, e isso fez um agente entregar
um diagnóstico errado com confiança.

## O que este repositório é

**wonderblue** — uma rede social fechada, por aprovação, sem anúncios. O membro
recebe um **nome estelar** e ninguém sabe quem é quem; a identidade real se
revela no encontro presencial.

> **"A conversa aqui vira encontro lá fora."**

Essa frase é a régua do produto: toda tela vale pelo quanto aproxima alguém de um
encontro real. `/encontros` é o destino; o resto é caminho.

Está **publicado** (Vercel, PWA instalável). **Não há usuários reais ainda.**

## Onde vive a verdade

| Pergunta | Onde se responde |
|---|---|
| Para onde vamos? | `docs/PLANO.md` |
| O que já está no banco? | rode `supabase/conferencia.sql` — **pergunte ao banco, não a um documento** |
| O que falta rodar? | `docs/sql-pendente.md` |
| Como o schema chegou aqui? | `supabase/migrations/` (histórico) |

## Arquitetura

- **Front:** Next.js + React + TypeScript, na **raiz** (`app/`, `components/`,
  `lib/`). Não existe pasta `web/`.
- **Back:** Supabase (Postgres + Auth + RLS + Realtime). **Toda regra de acesso
  mora no banco**, em RLS e triggers — nunca só na interface.
- **`engine/` (Python):** simulação de arena do conceito anterior (pentest).
  **Não está ligada ao app.** Ver decisão aberta nº 2 do plano.

## Invariantes — não quebre sem decidir explicitamente

1. **O nome real nunca aparece** para outro membro. Só nome estelar.
2. **Autor é sempre `auth.uid()`**, selado por trigger no banco. Nunca confie no
   cliente para dizer quem escreveu.
3. **Uma regra, um lugar.** `bloqueia_conta_invisivel()` é o padrão: uma função
   pendurada como trigger em *toda* superfície de escrita. Estendeu a função,
   cobriu a rede inteira. Repita esse padrão em vez de espalhar checagens.
4. **`profiles.role` é revogado para membros** — o papel vem da RPC `my_role()`,
   para que ninguém consiga listar quem são os administradores.
5. **Verdade derivada, nunca declarada.** O que um humano precisa lembrar de
   atualizar vai divergir. Prefira sempre o que é calculado da fonte.
6. **Sem e-mail.** O @ do Instagram é o login e vira um e-mail interno; a senha
   provisória é entregue por direct, à mão.

## Armadilhas conhecidas

- **Modo mock:** sem `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `lib/auth.tsx` cai
  num mock onde **qualquer credencial não-vazia entra**. Em produção isso é uma
  porta destrancada. Precisa de portão (ver plano, movimento 3).
- **`alter publication supabase_realtime add table` não é idempotente** — repetir
  derruba o script inteiro, porque o SQL Editor roda tudo numa transação. Use o
  bloco condicional de `supabase/rodadas/`.
- **Ordem das migrations importa:** 0025 estende `bloqueia_conta_invisivel()` e
  `profiles_select`; 0026 reescreve `posts_insert`. Rodar fora de ordem
  sobrescreve versão nova por velha.

## Convenções

- Código, comentários e interface em **português**.
- Comentário explica *por que*, não *o que*.
- Nada de biblioteca nova sem necessidade real (os ícones são SVG inline de
  propósito).
