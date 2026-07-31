"""Politicas de esquadrao: como atacantes e defensores decidem a cada tick.

Recebem o `world` (o agregado da simulacao) e operam sobre ele. Ficam aqui, fora
do orquestrador, para que a IA seja legivel e ajustavel sem tocar no loop nem na
gestao de round. Nao importam `world` (evita ciclo): so o consomem.
"""
from __future__ import annotations

import math

from . import config
from .combat import nearest_enemy, resolve_fire
from .pathfinding import find_cover, flow_dir, los_blocked
from .physics import slide_move


def step_attackers(world, alive_r, alive_b, dt: float):
    """Avancam pelo labirinto ate o nucleo com bounding overwatch; buscam quina ao levar tinta."""
    grid = world.grid
    cell = grid.cell
    rspd = cell * config.RED_SPEED_MUL
    rng = world._rng
    for s in alive_r:
        en, ed = nearest_enemy(s, alive_b)
        in_range = en is not None and ed < cell * config.RED_SIGHT_MUL
        clear = in_range and not los_blocked(grid, s.x, s.y, en.x, en.y)

        if s.suppress > 0 and en is not None:
            s.suppress -= dt
            s.state = "hit"
            cover = find_cover(grid, s.x, s.y, en.x, en.y, config.COVER_RADIUS)
            if cover:
                dx, dy = cover[0] - s.x, cover[1] - s.y
                dl = math.hypot(dx, dy) or 1.0
                slide_move(grid, s, dx / dl * rspd, dy / dl * rspd, dt)
            else:
                slide_move(grid, s, 0.0, 0.0, dt)
            s.flash = max(0.0, s.flash - dt)
            continue

        # bounding overwatch: alterna avancar e ficar de tocaia. Em contato, quem
        # esta "set" para e cobre o corredor enquanto os "move" avancam; sem inimigo
        # por perto, todos seguem em frente.
        s.bound_t -= dt
        if s.bound_t <= 0:
            if s.bound == "move":
                s.bound, s.bound_t = "set", rng.uniform(*config.BOUND_SET_TIME)
            else:
                s.bound, s.bound_t = "move", rng.uniform(*config.BOUND_MOVE_TIME)

        d = flow_dir(grid, s.x, s.y, world.field_core)
        if d is None:
            dx, dy = world.core[0] - s.x, world.core[1] - s.y
            dl = math.hypot(dx, dy) or 1.0
            d = (dx / dl, dy / dl)
        covering = s.bound == "set" and en is not None
        s.state = "engage" if clear else "move"
        spd = 0.0 if covering else rspd
        slide_move(grid, s, d[0] * spd, d[1] * spd, dt)
        if clear:
            s.cd -= dt
            if s.cd <= 0:
                resolve_fire(rng, world.tracers, s, en,
                             config.RED_ACC_COVER if covering else config.RED_ACC_MOVE)
                s.cd = (rng.uniform(*config.RED_CD_COVER) if covering
                        else rng.uniform(*config.RED_CD_MOVE))
        else:
            s.cd -= dt
        s.flash = max(0.0, s.flash - dt)


def step_defenders(world, alive_r, alive_b, dt: float):
    """Seguram os postos e focam fogo; convergem para o nucleo quando ele e ameacado."""
    grid = world.grid
    cell = grid.cell
    bspd = cell * config.BLUE_SPEED_MUL
    rng = world._rng
    for s in alive_b:
        en, ed = nearest_enemy(s, alive_r)
        in_range = en is not None and ed < cell * config.BLUE_SIGHT_MUL
        clear = in_range and not los_blocked(grid, s.x, s.y, en.x, en.y)

        if s.suppress > 0 and en is not None:
            s.suppress -= dt
            s.state = "hit"
            cover = find_cover(grid, s.x, s.y, en.x, en.y, config.COVER_RADIUS)
            if cover:
                dx, dy = cover[0] - s.x, cover[1] - s.y
                dl = math.hypot(dx, dy) or 1.0
                slide_move(grid, s, dx / dl * bspd, dy / dl * bspd, dt)
            else:
                slide_move(grid, s, 0.0, 0.0, dt)
            s.flash = max(0.0, s.flash - dt)
            continue

        s.state = "engage" if clear else "move"
        if world.core_cap > config.CORE_THREAT_THRESHOLD:
            cd_ = flow_dir(grid, s.x, s.y, world.field_core)
            tvx, tvy = (cd_[0] * bspd, cd_[1] * bspd) if cd_ else (0.0, 0.0)
        else:
            dx, dy = s.hx - s.x, s.hy - s.y
            dl = math.hypot(dx, dy)
            tvx = tvy = 0.0
            if dl > cell * config.POST_DEADZONE_MUL:
                tvx, tvy = dx / dl * bspd, dy / dl * bspd
        if clear:
            s.cd -= dt
            if s.cd <= 0:
                resolve_fire(rng, world.tracers, s, en, config.BLUE_ACC)
                s.cd = rng.uniform(*config.BLUE_CD)
            tvx += math.cos(s.aim + math.pi / 2) * bspd * config.BLUE_STRAFE_MUL
        else:
            s.cd -= dt
        slide_move(grid, s, tvx, tvy, dt)
        s.flash = max(0.0, s.flash - dt)
