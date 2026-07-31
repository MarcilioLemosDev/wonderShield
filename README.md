# WonderShield

Plataforma de pentest web para freelancers, com uma arena gameficada que abstrai
uma varredura em uma incursao de ataque e defesa dentro de um labirinto.

O trabalho legal e o produto: o freelancer traz o cliente com autorizacao
previa, a plataforma fornece o sistema de pentest rapido e a rede. O motor so
dispara contra alvo e janela consentidos.

## Arquitetura

Tres camadas, com necessidades diferentes, por isso separadas.

- **Vitrine + arena** (`web/`): Next.js + React + TypeScript. Desenha a arena num
  canvas lendo o estado por WebSocket. O front nao simula nada, e a janela.
- **Motor** (`engine/`): Python. O servidor autoritativo. Gera o labirinto, roda
  a IA de esquadrao, resolve o combate e emite o estado a cada tick. Depois, os
  eventos reais de um scan alimentam essa mesma simulacao.
- **Espinha** (`supabase/` + `engine/consent.py`): Supabase (Postgres, auth por
  convite, RLS) para perfis, convites, engajamentos e execucoes. O engajamento e
  o registro de consentimento que amarra o motor a um alvo e janela autorizados.

Servidor e a verdade, cliente e a vista. Esse e o principio.

## Motor (`engine/`)

Servidor autoritativo em Python.

- `maze.py`: labirinto por recursive backtracker com braiding (alcas para rotas
  alternativas). Devolve grade de ocupacao para pathfinding e visada.
- `sim.py`: mundo autoritativo. Soldados individuais (atacantes e defensores) com
  posicao, mira, estado e vida proprios. Pathfinding por campo de fluxo (BFS)
  pelos corredores, combate por visada, objetivo no nucleo ao fim do labirinto,
  cronometro de incursao de 90s com ondas de reforco.
- `server.py`: servidor WebSocket. Roda o loop e transmite `map` (uma vez) e
  `state` (~20x/s) aos clientes.
- `preview.py`: renderizador de validacao (Pillow) que gera um PNG de um instante
  da incursao, para conferir o labirinto e a legibilidade dos soldados.

## Front (`web/`)

Next.js + React + TypeScript. `components/Arena.tsx` conecta ao WebSocket, recebe
o mapa uma vez e o estado a cada quadro, e desenha a arena num canvas com
interpolacao entre quadros. Nao simula nada.

## Rodar tudo

```bash
# motor
pip install -r requirements.txt
python -m engine.server            # ws://0.0.0.0:8765

# front (outro terminal)
cd web && npm install && npm run dev
# abre http://localhost:3000  (aponta para o motor por NEXT_PUBLIC_ARENA_WS)
```

Validacao rapida so do motor, sem front:

```bash
python -m engine.preview preview.png 14 7   # saida, segundos simulados, seed
```

## Consentimento e banco (`engine/consent.py`, `supabase/`)

Nenhum scan dispara sem autorizacao valida. A regra vive em duas camadas:

- **Motor** (`engine/consent.py`): `authorize(engagement, alvo, agora)` checa
  status, janela de tempo, escopo de host (com subdominio, sem truque de sufixo)
  e token. Recusa por padrao. O servidor consulta antes de rodar.
- **Banco** (`supabase/migrations/0001_platform.sql`): a funcao `authorize_scan`
  espelha a mesma regra em SQL, e o RLS restringe quem ve o que. Defesa em
  profundidade.

Alvo de treino da plataforma (Juice Shop) e auto-consentido; alvo real exige um
engajamento ativo, assinado, dentro da janela.

### Validacao local

```bash
python -m unittest tests.test_consent           # checagem do motor
# schema + authorize_scan num Postgres cru:
#   aplica tests/pg/00_shim.sql, supabase/migrations/0001_platform.sql, tests/pg/10_checks.sql
```

### Conectar seu Supabase

1. Cria um projeto em supabase.com.
2. Roda `supabase/migrations/0001_platform.sql` no SQL Editor (o schema `auth` ja
   existe la, o shim de teste nao entra).
3. Poe a URL e as chaves em `web/.env.local` (ver `web/.env.example`).

## Proximos passos

1. Paginas da plataforma no `web/`: login por convite, diretorio, criacao de
   engajamento com o consentimento, atrelado ao Supabase.
2. Bounding overwatch de verdade na IA de esquadrao (um cobre, outro avanca).
3. Alimentar a simulacao com eventos reais de um scan consentido.
