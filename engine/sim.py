"""Simulacao autoritativa da arena.

O servidor e a verdade: aqui roda o labirinto, os soldados individuais, a IA de
esquadrao e o combate. O front so desenha o que esta simulacao emite. Cada
soldado e um agente com posicao, mira, estado e vida proprios, para que a
incursao se leia como um esquadrao varrendo o labirinto, nao como um enxame.
"""
from __future__ import annotations

import math
import random
from collections import deque
from dataclasses import dataclass, field, asdict

from . import maze as mz

ATK_TYPES = [
    "SQLi", "XSS", "RCE", "IDOR", "SSRF", "CSRF",
    "XXE", "AUTH BYPASS", "PATH TRAV", "PRIV ESC",
]
NB4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


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


class World:
    def __init__(self, cols: int = 21, rows: int = 13, seed: int = 1):
        self.cols, self.rows = cols, rows
        self.gw, self.gh = 2 * cols + 1, 2 * rows + 1

        # espaco em pixels (o front escala para a viewport dele); fixo por cols/rows
        self.W, self.H = 1600, 1000
        self.cell = min(self.W / self.gw, self.H / self.gh)
        self.ox = (self.W - self.cell * self.gw) / 2
        self.oy = (self.H - self.cell * self.gh) / 2
        self.srad = self.cell * 0.34   # raio do soldado

        self._base_seed = seed
        self._rng = random.Random(seed * 7 + 3)

        # estado de partida (persiste entre incursoes)
        self.round_time = 90.0
        self.incursion = 1
        self.holds = 0
        self.breaches = 0
        self.round_state = "live"   # 'live' | 'done'
        self.round_timer = 0.0
        self.interlude = 0.0
        self.last_result = ""       # 'hold' | 'breach' do round encerrado
        self.reds: list[Soldier] = []
        self.blues: list[Soldier] = []
        self.tracers: list[Tracer] = []
        self._next_id = 1
        self._red_budget = 0
        self._wave_clock = 0.0
        self.breach_reason = ""

        self.start_incursion()

    def _build_maze(self, seed: int):
        """Gera um labirinto novo e recomputa objetivo, campo de fluxo e postos."""
        self.open_walls = mz.generate(self.cols, self.rows, seed=seed, braid=0.35)
        self.grid, self.gw, self.gh = mz.to_grid(self.open_walls, self.cols, self.rows)
        # objetivo: o nucleo no fim (direita), com labirinto em volta
        cgx = self.gw - 6 if self.is_open(self.gw - 6, self.gh // 2) else self.gw - 4
        self.core_cell = (cgx, self.gh // 2)
        if not self.is_open(*self.core_cell):
            self.core_cell = self.nearest_open(*self.core_cell)
        self.core = self.cell_center(*self.core_cell)
        self.field_core = self.bfs_field(self.core_cell)
        self.posts = self._pick_posts()
        self.core_cap = 0.0

    # ---- conversoes grade <-> pixel ----
    def cell_center(self, i: int, j: int) -> tuple[float, float]:
        return (self.ox + (i + 0.5) * self.cell, self.oy + (j + 0.5) * self.cell)

    def to_cell(self, px: float, py: float) -> tuple[int, int]:
        i = int((px - self.ox) / self.cell)
        j = int((py - self.oy) / self.cell)
        return (max(0, min(self.gw - 1, i)), max(0, min(self.gh - 1, j)))

    def is_open(self, i: int, j: int) -> bool:
        return 0 <= i < self.gw and 0 <= j < self.gh and self.grid[j][i] == 0

    def nearest_open(self, i: int, j: int) -> tuple[int, int]:
        for r in range(1, 12):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if self.is_open(i + dx, j + dy):
                        return (i + dx, j + dy)
        return (i, j)

    # ---- pathfinding ----
    def bfs_field(self, goal_cell: tuple[int, int]) -> list[list[int]]:
        gx, gy = goal_cell
        if not self.is_open(gx, gy):
            gx, gy = self.nearest_open(gx, gy)
        dist = [[-1] * self.gw for _ in range(self.gh)]
        dist[gy][gx] = 0
        q = deque([(gx, gy)])
        while q:
            x, y = q.popleft()
            for dx, dy in NB4:
                nx, ny = x + dx, y + dy
                if self.is_open(nx, ny) and dist[ny][nx] == -1:
                    dist[ny][nx] = dist[y][x] + 1
                    q.append((nx, ny))
        return dist

    def flow_dir(self, px: float, py: float, field_):
        i, j = self.to_cell(px, py)
        best = field_[j][i]
        bi, bj = i, j
        for dx, dy in NB4:
            nx, ny = i + dx, j + dy
            if 0 <= nx < self.gw and 0 <= ny < self.gh:
                v = field_[ny][nx]
                if v >= 0 and (best < 0 or v < best):
                    best, bi, bj = v, nx, ny
        if (bi, bj) == (i, j):
            return None
        tx, ty = self.cell_center(bi, bj)
        dx, dy = tx - px, ty - py
        d = math.hypot(dx, dy) or 1.0
        return (dx / d, dy / d)

    def los_blocked(self, x1, y1, x2, y2) -> bool:
        dist = math.hypot(x2 - x1, y2 - y1)
        steps = int(dist / (self.cell * 0.4)) + 2
        for k in range(1, steps):
            t = k / steps
            i, j = self.to_cell(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
            if self.grid[j][i] == 1:
                return True
        return False

    # ---- setup de partida ----
    def _pick_posts(self) -> list[tuple[int, int]]:
        # celulas de aproximacao ao nucleo, a alguns passos dele, bem espalhadas,
        # para o defensor formar um anel dentro do labirinto e nao na borda
        cand = []
        for j in range(self.gh):
            for i in range(self.gw):
                dval = self.field_core[j][i]
                if 3 <= dval <= 11:
                    cand.append((dval, i, j))
        cand.sort()
        chosen: list[tuple[int, int]] = []
        for _, i, j in cand:
            if all((i - pi) ** 2 + (j - pj) ** 2 > 12 for pi, pj in chosen):
                chosen.append((i, j))
            if len(chosen) >= 6:
                break
        return chosen or [self.core_cell]

    def new_id(self) -> int:
        self._next_id += 1
        return self._next_id

    def spawn_red_squad(self, n: int):
        entries = [(1, gy) for gy in range(1, self.gh - 1) if self.is_open(1, gy)]
        for _ in range(n):
            if self._red_budget <= 0:
                break
            self._red_budget -= 1
            gx, gy = self._rng.choice(entries)
            x, y = self.cell_center(gx, gy)
            s = Soldier(self.new_id(), "red", x, y, kind=self._rng.choice(ATK_TYPES))
            s.bound_t = self._rng.uniform(0.0, 2.0)   # desincroniza o ciclo do esquadrao
            self.reds.append(s)

    def spawn_defenders(self):
        for gx, gy in self.posts:
            x, y = self.cell_center(gx, gy)
            s = Soldier(self.new_id(), "blue", x, y, hp=2, aim=math.pi)
            s.hx, s.hy = x, y
            self.blues.append(s)

    def start_incursion(self):
        # cada incursao gera um labirinto novo
        self._build_maze(self._base_seed * 1000 + self.incursion)
        self.reds, self.blues, self.tracers = [], [], []
        self._red_budget = 5 + self.incursion * 5
        self._wave_clock = 0.0
        self.round_state = "live"
        self.round_timer = 0.0
        self.breach_reason = ""
        self.spawn_defenders()
        self.spawn_red_squad(6)

    # ---- combate ----
    def nearest_enemy(self, s: Soldier, enemies: list[Soldier]):
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

    def fire(self, s: Soldier, target: Soldier, dt: float, accuracy: float):
        s.aim = math.atan2(target.y - s.y, target.x - s.x)
        s.flash = 0.08
        hit = self._rng.random() < accuracy
        ex, ey = target.x, target.y
        if not hit:
            ang = s.aim + self._rng.uniform(-0.25, 0.25)
            reach = math.hypot(ex - s.x, ey - s.y)
            ex, ey = s.x + math.cos(ang) * reach, s.y + math.sin(ang) * reach
        self.tracers.append(Tracer(s.x, s.y, ex, ey, s.team))
        if hit:
            target.hp -= 1
            target.suppress = 0.6
            if target.hp <= 0:
                target.alive = False
                target.state = "down"

    def find_cover(self, s: Soldier, tx: float, ty: float):
        """Celula aberta proxima cuja parede quebra a visada da ameaca (uma quina)."""
        si, sj = self.to_cell(s.x, s.y)
        best = None
        bd = 1e18
        for dj in range(-3, 4):
            for di in range(-3, 4):
                if di == 0 and dj == 0:
                    continue
                i, j = si + di, sj + dj
                if not self.is_open(i, j):
                    continue
                cx, cy = self.cell_center(i, j)
                if self.los_blocked(cx, cy, tx, ty):
                    d = di * di + dj * dj
                    if d < bd:
                        bd, best = d, (cx, cy)
        return best

    def _move(self, s: Soldier, tvx: float, tvy: float, dt: float):
        """Integra velocidade suavizada e desliza ao longo de parede em vez de atravessar."""
        k = min(1.0, 9 * dt)
        s.vx += (tvx - s.vx) * k
        s.vy += (tvy - s.vy) * k
        nx, ny = s.x + s.vx * dt, s.y + s.vy * dt
        i, j = self.to_cell(nx, ny)
        if self.grid[j][i] == 0:
            s.x, s.y = nx, ny
            return
        # tentaria entrar em parede: desliza pelo eixo que estiver livre
        ix, jx = self.to_cell(s.x + s.vx * dt, s.y)
        if self.grid[jx][ix] == 0:
            s.x += s.vx * dt
            s.vy = 0.0
            return
        iy, jy = self.to_cell(s.x, s.y + s.vy * dt)
        if self.grid[jy][iy] == 0:
            s.y += s.vy * dt
            s.vx = 0.0
            return
        s.vx = s.vy = 0.0

    # ---- tick ----
    def step(self, dt: float):
        if self.interlude > 0:
            self.interlude -= dt
            if self.interlude <= 0:
                self.incursion += 1
                self.start_incursion()
            return
        if self.round_state != "live":
            return
        self.round_timer += dt

        # ondas de reforco mantem a pressao durante o round
        self._wave_clock += dt
        if self._wave_clock > 8 and self._red_budget > 0:
            self._wave_clock = 0.0
            self.spawn_red_squad(4)

        alive_r = [s for s in self.reds if s.alive]
        alive_b = [s for s in self.blues if s.alive]
        rspd = self.cell * 6.0
        bspd = self.cell * 4.0
        breached = False

        # atacantes: avancam pelo labirinto ate o nucleo; quando levam tinta,
        # rompem a linha de visada dobrando uma quina em vez de morrer parados
        for s in alive_r:
            en, ed = self.nearest_enemy(s, alive_b)
            in_range = en is not None and ed < self.cell * 7
            clear = in_range and not self.los_blocked(s.x, s.y, en.x, en.y)
            if s.suppress > 0 and en is not None:
                s.suppress -= dt
                s.state = "hit"
                cover = self.find_cover(s, en.x, en.y)
                if cover:
                    dx, dy = cover[0] - s.x, cover[1] - s.y
                    dl = math.hypot(dx, dy) or 1.0
                    self._move(s, dx / dl * rspd, dy / dl * rspd, dt)
                else:
                    self._move(s, 0.0, 0.0, dt)
                s.flash = max(0.0, s.flash - dt)
                continue
            # bounding overwatch: alterna avancar e ficar de tocaia. Em contato,
            # quem esta "set" para e cobre o corredor enquanto os "move" avancam;
            # sem inimigo por perto, todos seguem em frente (nada de parar a toa).
            s.bound_t -= dt
            if s.bound_t <= 0:
                if s.bound == "move":
                    s.bound, s.bound_t = "set", self._rng.uniform(0.9, 1.5)
                else:
                    s.bound, s.bound_t = "move", self._rng.uniform(1.6, 2.4)
            d = self.flow_dir(s.x, s.y, self.field_core)
            if d is None:
                dx, dy = self.core[0] - s.x, self.core[1] - s.y
                dl = math.hypot(dx, dy) or 1.0
                d = (dx / dl, dy / dl)
            covering = s.bound == "set" and en is not None
            s.state = "engage" if clear else "move"
            spd = 0.0 if covering else rspd
            self._move(s, d[0] * spd, d[1] * spd, dt)
            if clear:
                s.cd -= dt
                if s.cd <= 0:
                    self.fire(s, en, dt, 0.34 if covering else 0.26)
                    s.cd = self._rng.uniform(0.5, 0.9) if covering else self._rng.uniform(0.7, 1.2)
            else:
                s.cd -= dt
            s.flash = max(0.0, s.flash - dt)

        # defensores: seguram os postos, focam fogo em quem tem visada
        for s in alive_b:
            en, ed = self.nearest_enemy(s, alive_r)
            in_range = en is not None and ed < self.cell * 8
            clear = in_range and not self.los_blocked(s.x, s.y, en.x, en.y)
            if s.suppress > 0 and en is not None:
                s.suppress -= dt
                s.state = "hit"
                cover = self.find_cover(s, en.x, en.y)
                if cover:
                    dx, dy = cover[0] - s.x, cover[1] - s.y
                    dl = math.hypot(dx, dy) or 1.0
                    self._move(s, dx / dl * bspd, dy / dl * bspd, dt)
                else:
                    self._move(s, 0.0, 0.0, dt)
                s.flash = max(0.0, s.flash - dt)
                continue
            s.state = "engage" if clear else "move"
            if self.core_cap > 0.1:
                # nucleo ameacado: converge para contesta-lo, nao fica no posto
                cd_ = self.flow_dir(s.x, s.y, self.field_core)
                tvx, tvy = (cd_[0] * bspd, cd_[1] * bspd) if cd_ else (0.0, 0.0)
            else:
                dx, dy = s.hx - s.x, s.hy - s.y
                dl = math.hypot(dx, dy)
                tvx = tvy = 0.0
                if dl > self.cell * 0.5:            # volta ao posto se afastou
                    tvx, tvy = dx / dl * bspd, dy / dl * bspd
            if clear:
                s.cd -= dt
                if s.cd <= 0:
                    self.fire(s, en, dt, 0.42)
                    s.cd = self._rng.uniform(0.45, 0.85)
                tvx += math.cos(s.aim + math.pi / 2) * bspd * 0.25   # strafe leve
            else:
                s.cd -= dt
            self._move(s, tvx, tvy, dt)
            s.flash = max(0.0, s.flash - dt)

        # tracers desvanecem
        for t in self.tracers:
            t.life -= dt * 5
        self.tracers = [t for t in self.tracers if t.life > 0]

        # nucleo tomado por superioridade numerica no ponto, nao por um toque:
        # o defensor abate o infiltrado solitario; so uma massa vermelha rompe
        rn = sum(1 for s in alive_r if math.hypot(self.core[0] - s.x, self.core[1] - s.y) < self.cell * 2.2)
        bn = sum(1 for s in alive_b if math.hypot(self.core[0] - s.x, self.core[1] - s.y) < self.cell * 4.0)
        if rn > bn:
            self.core_cap = min(1.0, self.core_cap + dt * 0.4 * (rn - bn))
            if self.core_cap >= 1.0:
                breached = True
        else:
            self.core_cap = max(0.0, self.core_cap - dt * 0.6)

        # fim de round
        r_left = sum(1 for s in self.reds if s.alive)
        if breached:
            self.end_round("breach")
        elif self.round_timer >= self.round_time:
            self.end_round("hold")
        elif self._red_budget <= 0 and r_left == 0:
            self.end_round("hold")

    def end_round(self, result: str):
        self.round_state = "done"
        self.last_result = result
        if result == "hold":
            self.holds += 1
        else:
            self.breaches += 1
        self.interlude = 2.6

    # ---- serializacao (preview + websocket) ----
    def walls_rects(self):
        rects = []
        for j in range(self.gh):
            for i in range(self.gw):
                if self.grid[j][i] == 1:
                    rects.append((self.ox + i * self.cell, self.oy + j * self.cell,
                                  self.cell, self.cell))
        return rects

    def snapshot(self) -> dict:
        return {
            "w": self.W, "h": self.H, "cell": self.cell, "srad": self.srad,
            "core": {"x": self.core[0], "y": self.core[1]}, "core_cap": self.core_cap,
            "incursion": self.incursion, "holds": self.holds, "breaches": self.breaches,
            "state": self.round_state, "last_result": self.last_result,
            "time_left": max(0.0, self.round_time - self.round_timer),
            "reds": [asdict(s) for s in self.reds if s.alive],
            "blues": [asdict(s) for s in self.blues if s.alive],
            "tracers": [asdict(t) for t in self.tracers],
        }
