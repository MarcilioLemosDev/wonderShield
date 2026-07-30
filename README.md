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
- **Espinha** (a definir): Supabase (Postgres, auth por convite, Realtime, RLS)
  para perfis, engajamentos e o registro de consentimento que amarra o motor.

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

## Proximos passos

1. Espinha Supabase (Postgres, auth por convite, Realtime, RLS) e o instrumento
   de consentimento que amarra o motor ao alvo e janela autorizados.
2. Labirinto novo por incursao e afinar a IA de esquadrao (lances, cobertura).
3. Alimentar a simulacao com eventos reais de um scan consentido.
