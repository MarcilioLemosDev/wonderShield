"""Geracao de labirinto.

Recursive backtracker (DFS) para um labirinto perfeito, seguido de um passo de
"braiding" que abre becos sem saida para criar alcas. As alcas dao rotas
alternativas, sem elas a incursao teria um unico caminho e o defensor venceria
sempre segurando um ponto so.

O labirinto e devolvido em dois formatos:
  - `open_walls`: por celula, o conjunto de direcoes abertas (para navegacao no
    grafo de celulas).
  - `to_grid`: uma grade de ocupacao (2*cols+1) x (2*rows+1) onde 1 e parede e 0
    e livre. Corredores tem uma celula de largura. Serve para pathfinding por
    campo de fluxo e para linha de visada.
"""
from __future__ import annotations

import random

DIRS = {"N": (0, -1), "S": (0, 1), "E": (1, 0), "W": (-1, 0)}
OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}


def generate(cols: int, rows: int, seed: int | None = None, braid: float = 0.35):
    """Devolve open_walls[cy][cx] = set de direcoes abertas."""
    rng = random.Random(seed)
    open_walls = [[set() for _ in range(cols)] for _ in range(rows)]
    visited = [[False] * cols for _ in range(rows)]

    stack = [(0, rows // 2)]
    visited[rows // 2][0] = True
    while stack:
        cx, cy = stack[-1]
        nbrs = []
        for d, (dx, dy) in DIRS.items():
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cols and 0 <= ny < rows and not visited[ny][nx]:
                nbrs.append((d, nx, ny))
        if nbrs:
            d, nx, ny = rng.choice(nbrs)
            open_walls[cy][cx].add(d)
            open_walls[ny][nx].add(OPP[d])
            visited[ny][nx] = True
            stack.append((nx, ny))
        else:
            stack.pop()

    # braiding: abre uma parede extra em becos, criando alcas
    for cy in range(rows):
        for cx in range(cols):
            if len(open_walls[cy][cx]) <= 1 and rng.random() < braid:
                choices = []
                for d, (dx, dy) in DIRS.items():
                    if d in open_walls[cy][cx]:
                        continue
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < cols and 0 <= ny < rows:
                        choices.append((d, nx, ny))
                if choices:
                    d, nx, ny = rng.choice(choices)
                    open_walls[cy][cx].add(d)
                    open_walls[ny][nx].add(OPP[d])
    return open_walls


def to_grid(open_walls, cols: int, rows: int):
    """Converte para grade de ocupacao. Devolve (grid, GW, GH). grid[y][x] em {0,1}."""
    gw, gh = 2 * cols + 1, 2 * rows + 1
    grid = [[1] * gw for _ in range(gh)]
    for cy in range(rows):
        for cx in range(cols):
            gx, gy = 2 * cx + 1, 2 * cy + 1
            grid[gy][gx] = 0
            for d in open_walls[cy][cx]:
                dx, dy = DIRS[d]
                grid[gy + dy][gx + dx] = 0
    return grid, gw, gh
