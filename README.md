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

## Motor (estado atual)

Scaffold do motor autoritativo:

- `engine/maze.py`: labirinto por recursive backtracker com braiding (alcas para
  rotas alternativas). Devolve grade de ocupacao para pathfinding e visada.
- `engine/sim.py`: mundo autoritativo. Soldados individuais (atacantes e
  defensores) com posicao, mira, estado e vida proprios. Pathfinding por campo de
  fluxo (BFS) pelos corredores, combate por visada, objetivo no nucleo ao fim do
  labirinto, cronometro de incursao de 90s com ondas de reforco.
- `engine/preview.py`: renderizador de validacao (Pillow) que gera um PNG de um
  instante da incursao. Nao e o front, e so para conferir que o labirinto e um
  labirinto e que os soldados se leem como individuos.

### Rodar o preview

```bash
pip install -r requirements.txt
python -m engine.preview preview.png 14 7   # saida, segundos simulados, seed
```

## Proximos passos

1. `engine/server.py`: servidor WebSocket que roda o loop e transmite o snapshot.
2. `web/`: front Next renderizando a arena a partir do stream.
3. Espinha Supabase e o instrumento de consentimento que amarra o motor.
