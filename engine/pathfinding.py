"""Navegacao no labirinto: campo de fluxo, direcao, linha de visada e cobertura.

Funcoes puras sobre uma `Grid`. O campo de fluxo e um BFS a partir do objetivo:
cada celula guarda a distancia ate ele, e o agente so precisa descer o gradiente.
"""
from __future__ import annotations

import math
from collections import deque

from .geometry import Grid

NB4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def bfs_field(grid: Grid, goal_cell: tuple[int, int]) -> list[list[int]]:
    """Distancia (em passos) de cada celula livre ate o objetivo; -1 se inalcancavel."""
    gx, gy = goal_cell
    if not grid.is_open(gx, gy):
        gx, gy = grid.nearest_open(gx, gy)
    dist = [[-1] * grid.gw for _ in range(grid.gh)]
    dist[gy][gx] = 0
    q = deque([(gx, gy)])
    while q:
        x, y = q.popleft()
        for dx, dy in NB4:
            nx, ny = x + dx, y + dy
            if grid.is_open(nx, ny) and dist[ny][nx] == -1:
                dist[ny][nx] = dist[y][x] + 1
                q.append((nx, ny))
    return dist


def flow_dir(grid: Grid, px: float, py: float, field: list[list[int]]):
    """Vetor unitario descendo o gradiente do campo; None se ja esta no objetivo."""
    i, j = grid.to_cell(px, py)
    best = field[j][i]
    bi, bj = i, j
    for dx, dy in NB4:
        nx, ny = i + dx, j + dy
        if 0 <= nx < grid.gw and 0 <= ny < grid.gh:
            v = field[ny][nx]
            if v >= 0 and (best < 0 or v < best):
                best, bi, bj = v, nx, ny
    if (bi, bj) == (i, j):
        return None
    tx, ty = grid.cell_center(bi, bj)
    dx, dy = tx - px, ty - py
    d = math.hypot(dx, dy) or 1.0
    return (dx / d, dy / d)


def los_blocked(grid: Grid, x1: float, y1: float, x2: float, y2: float) -> bool:
    """True se uma parede corta o segmento entre os dois pontos."""
    dist = math.hypot(x2 - x1, y2 - y1)
    steps = int(dist / (grid.cell * 0.4)) + 2
    for k in range(1, steps):
        t = k / steps
        i, j = grid.to_cell(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
        if grid.blocked(i, j):
            return True
    return False


def find_cover(grid: Grid, sx: float, sy: float, tx: float, ty: float, radius: int):
    """Celula aberta proxima cuja parede quebra a visada da ameaca (uma quina)."""
    si, sj = grid.to_cell(sx, sy)
    best = None
    bd = 1e18
    for dj in range(-radius, radius + 1):
        for di in range(-radius, radius + 1):
            if di == 0 and dj == 0:
                continue
            i, j = si + di, sj + dj
            if not grid.is_open(i, j):
                continue
            cx, cy = grid.cell_center(i, j)
            if los_blocked(grid, cx, cy, tx, ty):
                d = di * di + dj * dj
                if d < bd:
                    bd, best = d, (cx, cy)
    return best
