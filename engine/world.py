"""O agregado da simulacao: labirinto, tropa, rounds e o loop.

Orquestra as camadas de baixo (geometria, pathfinding, combate, fisica) e as
politicas de esquadrao (behaviors). O `step` le como o jogo: gerar reforco, mover
atacantes, mover defensores, decair tracers, disputar o nucleo, checar fim.
"""
from __future__ import annotations

import math
import random
from dataclasses import asdict

from . import behaviors, config
from . import maze as mz
from .entities import Soldier, Tracer
from .geometry import Grid
from .pathfinding import bfs_field


class World:
    def __init__(self, cols: int = config.COLS, rows: int = config.ROWS, seed: int = 1):
        self.cols, self.rows = cols, rows
        self.gw, self.gh = 2 * cols + 1, 2 * rows + 1

        # espaco em pixels (o front escala para a viewport dele); fixo por cols/rows
        self.W, self.H = config.WORLD_W, config.WORLD_H
        self.cell = min(self.W / self.gw, self.H / self.gh)
        self.ox = (self.W - self.cell * self.gw) / 2
        self.oy = (self.H - self.cell * self.gh) / 2
        self.srad = self.cell * config.SOLDIER_RADIUS_MUL

        self._base_seed = seed
        self._rng = random.Random(seed * 7 + 3)

        # estado de partida (persiste entre incursoes)
        self.round_time = config.ROUND_TIME
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

    # ---- construcao da arena ----
    def _build_maze(self, seed: int):
        """Gera um labirinto novo e recomputa objetivo, campo de fluxo e postos."""
        open_walls = mz.generate(self.cols, self.rows, seed=seed, braid=config.MAZE_BRAID)
        occupancy, self.gw, self.gh = mz.to_grid(open_walls, self.cols, self.rows)
        self.grid = Grid(occupancy, self.gw, self.gh, self.cell, self.ox, self.oy)

        # objetivo: o nucleo no fim (direita), com labirinto em volta
        mid = self.gh // 2
        cgx = (self.gw - config.CORE_COL_FROM_RIGHT
               if self.grid.is_open(self.gw - config.CORE_COL_FROM_RIGHT, mid)
               else self.gw - config.CORE_COL_FALLBACK)
        self.core_cell = (cgx, mid)
        if not self.grid.is_open(*self.core_cell):
            self.core_cell = self.grid.nearest_open(*self.core_cell)
        self.core = self.grid.cell_center(*self.core_cell)
        self.field_core = bfs_field(self.grid, self.core_cell)
        self.posts = self._pick_posts()
        self.core_cap = 0.0

    def _pick_posts(self) -> list[tuple[int, int]]:
        # celulas de aproximacao ao nucleo, bem espalhadas, para o defensor formar
        # um anel dentro do labirinto e nao na borda
        cand = []
        for j in range(self.gh):
            for i in range(self.gw):
                dval = self.field_core[j][i]
                if config.POST_MIN_STEPS <= dval <= config.POST_MAX_STEPS:
                    cand.append((dval, i, j))
        cand.sort()
        chosen: list[tuple[int, int]] = []
        for _, i, j in cand:
            if all((i - pi) ** 2 + (j - pj) ** 2 > config.POST_SEPARATION_SQ
                   for pi, pj in chosen):
                chosen.append((i, j))
            if len(chosen) >= config.POST_COUNT:
                break
        return chosen or [self.core_cell]

    # ---- geracao de tropa ----
    def _new_id(self) -> int:
        self._next_id += 1
        return self._next_id

    def spawn_red_squad(self, n: int):
        g = self.grid
        entries = [(1, gy) for gy in range(1, self.gh - 1) if g.is_open(1, gy)]
        for _ in range(n):
            if self._red_budget <= 0:
                break
            self._red_budget -= 1
            gx, gy = self._rng.choice(entries)
            x, y = g.cell_center(gx, gy)
            s = Soldier(self._new_id(), "red", x, y, hp=config.RED_HP,
                        kind=self._rng.choice(config.ATK_TYPES))
            s.bound_t = self._rng.uniform(*config.BOUND_INIT_JITTER)
            self.reds.append(s)

    def spawn_defenders(self):
        g = self.grid
        for gx, gy in self.posts:
            x, y = g.cell_center(gx, gy)
            s = Soldier(self._new_id(), "blue", x, y, hp=config.BLUE_HP, aim=math.pi)
            s.hx, s.hy = x, y
            self.blues.append(s)

    def start_incursion(self):
        # cada incursao gera um labirinto novo
        self._build_maze(self._base_seed * 1000 + self.incursion)
        self.reds, self.blues, self.tracers = [], [], []
        self._red_budget = config.RED_BUDGET_BASE + self.incursion * config.RED_BUDGET_PER_INCURSION
        self._wave_clock = 0.0
        self.round_state = "live"
        self.round_timer = 0.0
        self.breach_reason = ""
        self.spawn_defenders()
        self.spawn_red_squad(config.RED_INITIAL_SQUAD)

    # ---- loop ----
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
        self._spawn_waves(dt)

        alive_r = [s for s in self.reds if s.alive]
        alive_b = [s for s in self.blues if s.alive]
        behaviors.step_attackers(self, alive_r, alive_b, dt)
        behaviors.step_defenders(self, alive_r, alive_b, dt)

        self._decay_tracers(dt)
        breached = self._contest_core(alive_r, alive_b, dt)
        self._check_round_end(breached)

    def _spawn_waves(self, dt: float):
        self._wave_clock += dt
        if self._wave_clock > config.RED_WAVE_INTERVAL and self._red_budget > 0:
            self._wave_clock = 0.0
            self.spawn_red_squad(config.RED_WAVE_SQUAD)

    def _decay_tracers(self, dt: float):
        for t in self.tracers:
            t.life -= dt * config.TRACER_DECAY
        self.tracers = [t for t in self.tracers if t.life > 0]

    def _contest_core(self, alive_r, alive_b, dt: float) -> bool:
        # nucleo tomado por superioridade numerica no ponto, nao por um toque: o
        # defensor abate o infiltrado solitario, so uma massa vermelha rompe
        ar = self.cell * config.CORE_ATTACK_RADIUS_MUL
        br = self.cell * config.CORE_DEFEND_RADIUS_MUL
        rn = sum(1 for s in alive_r if math.hypot(self.core[0] - s.x, self.core[1] - s.y) < ar)
        bn = sum(1 for s in alive_b if math.hypot(self.core[0] - s.x, self.core[1] - s.y) < br)
        if rn > bn:
            self.core_cap = min(1.0, self.core_cap + dt * config.CORE_CAPTURE_RATE * (rn - bn))
            return self.core_cap >= 1.0
        self.core_cap = max(0.0, self.core_cap - dt * config.CORE_DECAY_RATE)
        return False

    def _check_round_end(self, breached: bool):
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
        self.interlude = config.INTERLUDE

    # ---- serializacao (preview + websocket) ----
    def walls_rects(self):
        return self.grid.wall_rects()

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
