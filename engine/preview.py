"""Renderizador de validacao (Pillow).

Nao e o front de producao (esse e o canvas no Next lendo por WebSocket). Serve
para validar, com o motor real rodando, que o labirinto gerado e um labirinto de
verdade e que os soldados se leem como individuos. Gera um PNG de um instante da
incursao.

Uso:
    python -m engine.preview [saida.png] [segundos] [seed]
"""
from __future__ import annotations

import math
import sys

from PIL import Image, ImageDraw, ImageFont

from .world import World

BG = (5, 7, 13)
WALL = (26, 37, 58)
WALL_EDGE = (60, 82, 120)
RED = (255, 45, 85)
BLUE = (56, 189, 248)
CYAN = (94, 234, 212)
INK = (200, 212, 230)
DIM = (91, 107, 130)


def _font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _soldier(draw: ImageDraw.ImageDraw, s, r: float):
    color = RED if s.team == "red" else BLUE
    dim = 0.5 if s.suppress > 0 else 1.0
    body = tuple(int(c * dim) for c in color)
    # halo suave
    draw.ellipse([s.x - r * 1.9, s.y - r * 1.9, s.x + r * 1.9, s.y + r * 1.9],
                 fill=tuple(int(c * 0.18) for c in color))
    # corpo
    draw.ellipse([s.x - r, s.y - r, s.x + r, s.y + r], fill=body,
                 outline=(10, 14, 22), width=max(1, int(r * 0.2)))
    # nucleo brilhante
    draw.ellipse([s.x - r * 0.42, s.y - r * 0.42, s.x + r * 0.42, s.y + r * 0.42],
                 fill=(255, 255, 255))
    # cano / direcao de mira
    bx, by = s.x + math.cos(s.aim) * r * 1.7, s.y + math.sin(s.aim) * r * 1.7
    draw.line([s.x, s.y, bx, by], fill=body, width=max(2, int(r * 0.34)))
    # anel de estado quando engajando
    if s.state == "engage":
        draw.ellipse([s.x - r * 1.35, s.y - r * 1.35, s.x + r * 1.35, s.y + r * 1.35],
                     outline=(255, 255, 255), width=max(1, int(r * 0.16)))
    # clarao do disparo
    if s.flash > 0:
        draw.ellipse([bx - r * 0.6, by - r * 0.6, bx + r * 0.6, by + r * 0.6],
                     fill=(255, 240, 200))


def render(world: World) -> Image.Image:
    img = Image.new("RGB", (world.W, world.H), BG)
    d = ImageDraw.Draw(img)

    # paredes do labirinto
    for (x, y, w, h) in world.walls_rects():
        d.rectangle([x, y, x + w, y + h], fill=WALL, outline=WALL_EDGE, width=1)

    # nucleo (objetivo no fim)
    cx, cy = world.core
    for k, rr in enumerate((world.cell * 2.4, world.cell * 1.6, world.cell * 0.9)):
        a = (0.12, 0.22, 0.6)[k]
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=tuple(int(c * a) for c in CYAN))
    d.ellipse([cx - world.cell * 0.9, cy - world.cell * 0.9,
               cx + world.cell * 0.9, cy + world.cell * 0.9],
              outline=CYAN, width=3)
    if world.core_cap > 0.01:
        cr = world.cell * 1.15
        d.arc([cx - cr, cy - cr, cx + cr, cy + cr], -90, -90 + 360 * world.core_cap,
              fill=RED, width=5)

    # tracers
    for t in world.tracers:
        col = CYAN if t.team == "blue" else (255, 120, 90)
        d.line([t.x1, t.y1, t.x2, t.y2], fill=col, width=2)

    r = world.srad
    for s in world.blues:
        if s.alive:
            _soldier(d, s, r)
    for s in world.reds:
        if s.alive:
            _soldier(d, s, r)

    # HUD
    big, small = _font(46), _font(18)
    tl = world.round_time - world.round_timer
    tl = max(0.0, tl)
    clock = f"{int(tl // 60)}:{int(tl % 60):02d}"
    d.text((world.W / 2, 30), clock, font=big, fill=(255, 176, 32), anchor="mt")
    d.text((world.W / 2, 84), "TIME TO OBJECTIVE", font=small, fill=DIM, anchor="mt")
    d.text((30, 30), "WONDERSHIELD", font=_font(26), fill=(234, 242, 255))
    d.text((30, 66), "LIVE INCURSION · ARENA", font=small, fill=DIM)
    rc = sum(1 for s in world.reds if s.alive)
    bc = sum(1 for s in world.blues if s.alive)
    hud = f"INCURSION {world.incursion:02d}    RED {rc}    BLUE {bc}    HOLDS {world.holds}    BREACHES {world.breaches}"
    d.text((world.W - 30, 40), hud, font=small, fill=INK, anchor="rt")

    # banner de desfecho durante o intervalo
    if world.round_state == "done" and world.last_result:
        held = world.last_result == "hold"
        label = "HELD" if held else "BREACH"
        sub = "OBJECTIVE SECURED" if held else "OBJECTIVE COMPROMISED"
        col = CYAN if held else RED
        d.text((world.W / 2, world.H / 2 - 20), label, font=_font(72), fill=col, anchor="mm")
        d.text((world.W / 2, world.H / 2 + 34), sub, font=small, fill=DIM, anchor="mm")
    return img


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "preview.png"
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 12.0
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 7
    world = World(seed=seed)
    dt = 1 / 30
    for _ in range(int(seconds / dt)):
        world.step(dt)
    render(world).save(out)
    snap = world.snapshot()
    print(f"gerado {out} | incursao {snap['incursion']} | "
          f"red {len(snap['reds'])} blue {len(snap['blues'])} | "
          f"holds {world.holds} breaches {world.breaches} | "
          f"tempo restante {snap['time_left']:.0f}s")


if __name__ == "__main__":
    main()
