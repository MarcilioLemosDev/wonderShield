"""Servidor WebSocket da arena.

Roda a simulacao autoritativa e transmite o estado do mundo aos clientes. O
front nao simula nada: conecta, recebe o mapa uma vez e depois o estado a cada
quadro, e apenas desenha.

Protocolo (JSON):
  - `{"type": "map", ...}`   enviado ao conectar e a cada nova incursao: paredes,
    dimensoes, celula, nucleo.
  - `{"type": "state", ...}` enviado ~20x/s: soldados, tracers, cronometro, placar.

Uso:
    python -m engine.server            # 0.0.0.0:8765
    python -m engine.server 8080       # porta custom
"""
from __future__ import annotations

import asyncio
import json
import sys
import time

import websockets

from .consent import Engagement, authorize, training_engagement
from .sim import World

TICK = 1 / 30           # passo da simulacao
STATE_HZ = 20           # frequencia de envio do estado


class Arena:
    def __init__(self, seed: int | None = None, engagement: Engagement | None = None):
        self.world = World(seed=seed if seed is not None else int(time.time()))
        self.clients: set = set()
        # espinha legal: nenhum scan roda sem autorizacao valida
        self.engagement = engagement or training_engagement()
        self.auth = authorize(self.engagement, self.engagement.target_host)

    def map_msg(self) -> str:
        w = self.world
        return json.dumps({
            "type": "map",
            "w": w.W, "h": w.H, "cell": w.cell, "srad": w.srad,
            "core": {"x": w.core[0], "y": w.core[1]},
            "incursion": w.incursion,
            "walls": w.walls_rects(),
        })

    def state_msg(self) -> str:
        snap = self.world.snapshot()
        snap["type"] = "state"
        return json.dumps(snap)

    async def register(self, ws, *_):
        self.clients.add(ws)
        try:
            await ws.send(self.map_msg())
            async for _msg in ws:
                pass  # cliente e espectador; comandos entram no futuro
        except websockets.ConnectionClosed:
            pass
        finally:
            self.clients.discard(ws)

    async def broadcast(self, data: str):
        for ws in list(self.clients):
            try:
                await ws.send(data)
            except websockets.ConnectionClosed:
                self.clients.discard(ws)

    async def run(self):
        if not self.auth.ok:
            print(f"scan recusado pela checagem de consentimento: {self.auth.reason}")
            return
        print(f"consentimento ok: {self.auth.reason} (engagement={self.auth.engagement_id})")
        last_inc = self.world.incursion
        send_every = max(1, round((1 / STATE_HZ) / TICK))
        i = 0
        next_t = time.perf_counter()
        while True:
            self.world.step(TICK)
            if self.world.incursion != last_inc:
                last_inc = self.world.incursion
                await self.broadcast(self.map_msg())
            i += 1
            if i % send_every == 0 and self.clients:
                await self.broadcast(self.state_msg())
            next_t += TICK
            await asyncio.sleep(max(0.0, next_t - time.perf_counter()))


async def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    arena = Arena()
    async with websockets.serve(arena.register, "0.0.0.0", port):
        print(f"arena no ar em ws://0.0.0.0:{port}")
        await arena.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
