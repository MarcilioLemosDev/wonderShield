"""Combate: alvo mais proximo e resolucao de tiro (hitscan com tracer)."""
from __future__ import annotations

import math
import random

from . import config
from .entities import Soldier, Tracer


def nearest_enemy(s: Soldier, enemies: list[Soldier]):
    """Devolve (inimigo, distancia) do vivo mais proximo, ou (None, 0)."""
    best, bd = None, 1e18
    for e in enemies:
        if not e.alive:
            continue
        d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2
        if d < bd:
            bd, best = d, e
    if best is None:
        return None, 0.0
    return best, math.sqrt(bd)


def resolve_fire(rng: random.Random, tracers: list[Tracer],
                 s: Soldier, target: Soldier, accuracy: float):
    """Mira, dispara, registra o tracer e aplica o dano se acertar."""
    s.aim = math.atan2(target.y - s.y, target.x - s.x)
    s.flash = config.FLASH_TIME
    hit = rng.random() < accuracy
    ex, ey = target.x, target.y
    if not hit:
        ang = s.aim + rng.uniform(-config.FIRE_MISS_SPREAD, config.FIRE_MISS_SPREAD)
        reach = math.hypot(ex - s.x, ey - s.y)
        ex, ey = s.x + math.cos(ang) * reach, s.y + math.sin(ang) * reach
    tracers.append(Tracer(s.x, s.y, ex, ey, s.team))
    if hit:
        target.hp -= 1
        target.suppress = config.SUPPRESS_TIME
        if target.hp <= 0:
            target.alive = False
            target.state = "down"
