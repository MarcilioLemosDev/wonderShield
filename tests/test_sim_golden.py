"""Teste de caracterizacao: a refatoracao nao pode mudar o comportamento.

Roda a simulacao com seed fixa e compara uma impressao digital deterministica
(contagens, cronometro, captura e checksum de posicoes ao longo do tempo) com um
valor de referencia capturado antes do refactor. Se a arquitetura mudar mas a
fisica ficar igual, este teste continua passando.
"""
import hashlib
import unittest

from engine.world import World

GOLDEN = {
    (1, 1800): "ef450c0eec5b21ccf69be343a64bee70",
    (7, 900): "58a7b0508fa115232a12b7caf8db68d0",
}


def fingerprint(seed: int, steps: int) -> str:
    w = World(seed=seed)
    h = hashlib.md5()
    for i in range(steps):
        w.step(1 / 30)
        if i % 30 == 0:
            reds = sum(1 for s in w.reds if s.alive)
            blues = sum(1 for s in w.blues if s.alive)
            pc = 0
            for s in w.reds:
                if s.alive:
                    pc += int(s.x) * 31 + int(s.y) * 17
            for s in w.blues:
                if s.alive:
                    pc += int(s.x) * 13 + int(s.y) * 7
            h.update(
                f"{i},{w.incursion},{reds},{blues},"
                f"{round(w.round_timer, 1)},{round(w.core_cap, 2)},{pc}\n".encode()
            )
    return h.hexdigest()


class TestSimGolden(unittest.TestCase):
    def test_behavior_preserved(self):
        for (seed, steps), expected in GOLDEN.items():
            with self.subTest(seed=seed, steps=steps):
                self.assertEqual(fingerprint(seed, steps), expected)


if __name__ == "__main__":
    unittest.main()
