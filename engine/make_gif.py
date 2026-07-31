"""Gera um GIF de uma incursao completa, do inicio ao desfecho.

Ferramenta de showcase: roda o motor, captura um quadro a cada 0.5s de
simulacao e monta um GIF ate o round encerrar (breach ou hold), segurando o
banner do resultado no fim.

Uso:
    python -m engine.make_gif [saida.gif] [seed|auto] [largura]
"""
from __future__ import annotations

import sys

from PIL import Image

from .preview import render
from .world import World

DT = 1 / 30


def _round_one(seed: int):
    w = World(seed=seed)
    t = 0.0
    while w.round_state == "live" and t < 95:
        w.step(DT)
        t += DT
    return w.last_result, t, sum(1 for s in w.blues if not s.alive)


def pick_seed() -> int:
    """Prefere um breach entre 35s e 80s (arco completo e dramatico)."""
    fallback = 1
    for s in range(1, 40):
        result, t, _ = _round_one(s)
        if result == "breach" and 35 <= t <= 80:
            return s
    return fallback


def make(out: str, seed: int, width: int = 900):
    w = World(seed=seed)
    scale = width / w.W
    size = (width, round(w.H * scale))
    rgb: list[Image.Image] = []
    tick = 0
    ended_at = None
    live_frames = 0
    while True:
        w.step(DT)
        tick += 1
        if tick % 18 == 0:  # 0.6s de simulacao por quadro
            rgb.append(render(w).resize(size, Image.LANCZOS))
            if w.round_state == "live":
                live_frames += 1
        if w.round_state == "done" and ended_at is None:
            ended_at = tick
        if ended_at is not None and tick - ended_at > 2.3 * 30:
            break
        if tick > 100 * 30:
            break
    # paleta compartilhada, tirada de um quadro de combate (nao do banner parado),
    # para preservar os brilhos neon; pixels que nao mudam ficam identicos e a
    # compressao delta do GIF corta o tamanho
    master = rgb[max(0, live_frames // 2)].convert("P", palette=Image.ADAPTIVE, colors=128)
    frames = [f.quantize(palette=master, dither=Image.Dither.NONE) for f in rgb]
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=70, loop=0, optimize=True)
    print(f"gerado {out} | {len(frames)} quadros | resultado {w.last_result} | seed {seed}")


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "incursao.gif"
    arg = sys.argv[2] if len(sys.argv) > 2 else "auto"
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 900
    seed = pick_seed() if arg == "auto" else int(arg)
    make(out, seed, width)


if __name__ == "__main__":
    main()
