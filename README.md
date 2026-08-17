# wonderblue

Uma rede social fechada, por aprovação, sem anúncios. Cada membro recebe um
**nome estelar** — dentro da rede ninguém sabe quem é quem. A identidade real se
revela no encontro presencial.

> **A conversa aqui vira encontro lá fora.**

Essa frase é a régua do produto: toda tela vale pelo quanto aproxima alguém de um
encontro real. `/encontros` é o destino; o resto é caminho até lá.

Publicado na Vercel, instalável como app (PWA). Para onde vamos:
[`docs/PLANO.md`](docs/PLANO.md). Orientação para quem (ou o que) chega agora:
[`CLAUDE.md`](CLAUDE.md).

> **Nota:** este repositório se chama `wonderShield` por herança de um conceito
> anterior (plataforma de pentest com arena gameficada). O produto que está no ar
> é o wonderblue. O motor daquele conceito segue em `engine/`, hoje desligado do
> app — ver "Herança" no fim.

## Como funciona a porta

Não existe e-mail em nenhum ponto. O @ do Instagram é o login.

1. A pessoa se apresenta em `/aplicar` — nome, @, idade, profissão, cidade,
   signo, momento.
2. A administração confere o Instagram (é isso que garante que existe gente de
   verdade) e cria o membro com um **nome estelar**.
3. A senha provisória vai **por direct**, à mão.
4. No primeiro login, a troca de senha é obrigatória.

O gargalo é humano por escolha: serve aos primeiros membros e mantém a rede
sendo o que ela diz ser.

## Arquitetura

Duas camadas, e a regra mora na de baixo.

- **Front** — Next.js + React + TypeScript, na raiz: `app/`, `components/`,
  `lib/`. Interface em português, ícones em SVG inline (sem biblioteca).
- **Back** — Supabase: Postgres, Auth, **RLS** e Realtime. Toda regra de acesso
  vive no banco, em policies e triggers — nunca só na interface. O cliente é a
  janela, o servidor é a verdade.

O padrão a repetir: **uma regra, um lugar.** A função
`bloqueia_conta_invisivel()` está pendurada como trigger em *toda* superfície de
escrita — chat, presença, posts, reações, comentários, DM, pedidos de tribo.
Estender a função cobre a rede inteira de uma vez.

## Os domínios

| Domínio | Telas |
|---|---|
| Porta | `/aplicar`, `/login`, `/esqueci` |
| Presença | `/feed` |
| Conversa | `/chat`, `/dm` |
| Pertencimento | `/tribos`, `/tribos/[id]`, `/rede` |
| **Encontro** | `/encontros` |
| Identidade | `/perfil`, `/u/[id]` |
| Governança | `/admin` |

## Rodar local

```bash
npm install
cp .env.example .env.local     # preencha as chaves do Supabase
npm run dev                    # http://localhost:3000
```

Sem as variáveis do Supabase o app cai num **modo mock** onde qualquer
credencial entra — serve para navegar o preview, e **nunca deve ir para
produção**. Ver armadilhas em [`CLAUDE.md`](CLAUDE.md).

## Banco

```
supabase/
├── migrations/        histórico do schema, uma por sprint
├── conferencia.sql    o que está REALMENTE no banco (pergunta ao banco)
└── rodadas/           blocos prontos para colar no SQL Editor
```

Para saber o estado do banco, **rode a conferência** — não confie em documento.
O que ainda falta aplicar está em [`docs/sql-pendente.md`](docs/sql-pendente.md).

## Herança — `engine/`

O conceito anterior deste repositório era uma plataforma de pentest para
freelancers, com uma arena gameficada: um motor autoritativo em Python
(`engine/`) gerava um labirinto e simulava uma incursão de ataque e defesa,
transmitindo o estado por WebSocket.

Esse motor continua aqui, com seus testes (`tests/test_consent.py`,
`tests/test_sim_golden.py`), mas **não está ligado ao wonderblue** — nenhuma rota
do app o consome. A migration `0001_platform.sql` ainda carrega a função
`authorize_scan` daquela época. Decidir o destino dele é item aberto do plano.

```bash
pip install -r requirements.txt
python -m engine.server                      # ws://0.0.0.0:8765
python -m engine.preview preview.png 14 7    # PNG de um instante da incursão
python -m unittest tests.test_consent
```
