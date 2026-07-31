"""Grade do labirinto e conversao grade <-> pixel.

A `Grid` guarda a ocupacao (1 parede, 0 livre) e sabe converter entre celula e
pixel. Nao conhece soldados nem IA: e a camada mais interna, so espaco.
"""
from __future__ import annotations


class Grid:
    def __init__(self, occupancy: list[list[int]], gw: int, gh: int,
                 cell: float, ox: float, oy: float):
        self.g = occupancy
        self.gw = gw
        self.gh = gh
        self.cell = cell
        self.ox = ox
        self.oy = oy

    def cell_center(self, i: int, j: int) -> tuple[float, float]:
        return (self.ox + (i + 0.5) * self.cell, self.oy + (j + 0.5) * self.cell)

    def to_cell(self, px: float, py: float) -> tuple[int, int]:
        i = int((px - self.ox) / self.cell)
        j = int((py - self.oy) / self.cell)
        return (max(0, min(self.gw - 1, i)), max(0, min(self.gh - 1, j)))

    def blocked(self, i: int, j: int) -> bool:
        return self.g[j][i] == 1

    def is_open(self, i: int, j: int) -> bool:
        return 0 <= i < self.gw and 0 <= j < self.gh and self.g[j][i] == 0

    def nearest_open(self, i: int, j: int) -> tuple[int, int]:
        for r in range(1, 12):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if self.is_open(i + dx, j + dy):
                        return (i + dx, j + dy)
        return (i, j)

    def wall_rects(self) -> list[tuple[float, float, float, float]]:
        """Retangulos de parede em pixels (para o front desenhar)."""
        rects = []
        for j in range(self.gh):
            for i in range(self.gw):
                if self.g[j][i] == 1:
                    rects.append((self.ox + i * self.cell, self.oy + j * self.cell,
                                  self.cell, self.cell))
        return rects
