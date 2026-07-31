"""Entidades do dominio: os agentes e os tiros. So dados, sem comportamento."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Soldier:
    id: int
    team: str          # 'red' | 'blue'
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0
    aim: float = 0.0
    hp: int = 1
    cd: float = 0.0
    state: str = "move"   # 'move' | 'engage' | 'hit' | 'down'
    kind: str = ""        # tecnica de ataque (red)
    flash: float = 0.0    # tempo restante do fogo (para o front animar)
    suppress: float = 0.0
    alive: bool = True
    hx: float = 0.0       # posto de origem (defensores)
    hy: float = 0.0
    bound: str = "move"   # 'move' | 'set' — ciclo de bounding overwatch (atacantes)
    bound_t: float = 0.0


@dataclass
class Tracer:
    x1: float
    y1: float
    x2: float
    y2: float
    team: str
    life: float = 1.0
