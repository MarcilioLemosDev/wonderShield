"""Integracao de movimento: velocidade suavizada e deslize ao longo da parede."""
from __future__ import annotations

from . import config
from .entities import Soldier
from .geometry import Grid


def slide_move(grid: Grid, s: Soldier, tvx: float, tvy: float, dt: float):
    """Aproxima a velocidade do alvo e move; ao topar parede, desliza pelo eixo livre."""
    k = min(1.0, config.MOVE_SMOOTHING * dt)
    s.vx += (tvx - s.vx) * k
    s.vy += (tvy - s.vy) * k
    nx, ny = s.x + s.vx * dt, s.y + s.vy * dt
    i, j = grid.to_cell(nx, ny)
    if not grid.blocked(i, j):
        s.x, s.y = nx, ny
        return
    ix, jx = grid.to_cell(s.x + s.vx * dt, s.y)
    if not grid.blocked(ix, jx):
        s.x += s.vx * dt
        s.vy = 0.0
        return
    iy, jy = grid.to_cell(s.x, s.y + s.vy * dt)
    if not grid.blocked(iy, jy):
        s.y += s.vy * dt
        s.vx = 0.0
        return
    s.vx = s.vy = 0.0
