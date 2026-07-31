"""Parametros da simulacao, num lugar so.

Antes, estes numeros viviam espalhados como constantes magicas no meio da IA.
Reuni-los aqui torna o balanceamento uma edicao de dados, nao de logica.
Multiplicadores de velocidade e alcance sao relativos ao tamanho da celula, para
a fisica escalar com o labirinto.
"""
from __future__ import annotations

# ---- geometria ----
WORLD_W, WORLD_H = 1600, 1000
COLS, ROWS = 21, 13
SOLDIER_RADIUS_MUL = 0.34

# ---- round ----
ROUND_TIME = 90.0
INTERLUDE = 2.6

# ---- labirinto e objetivo ----
MAZE_BRAID = 0.35
CORE_COL_FROM_RIGHT = 6      # coluna do nucleo, contada da borda direita
CORE_COL_FALLBACK = 4
POST_MIN_STEPS = 3           # postos entre N e M passos do nucleo
POST_MAX_STEPS = 11
POST_COUNT = 6
POST_SEPARATION_SQ = 12      # distancia^2 minima entre postos (celulas)

# ---- geracao de tropa ----
RED_HP = 1
BLUE_HP = 2
RED_BUDGET_BASE = 5
RED_BUDGET_PER_INCURSION = 5
RED_INITIAL_SQUAD = 6
RED_WAVE_SQUAD = 4
RED_WAVE_INTERVAL = 8.0

# ---- movimento (multiplos de cell/s) ----
RED_SPEED_MUL = 6.0
BLUE_SPEED_MUL = 4.0
MOVE_SMOOTHING = 9.0         # suavizacao da velocidade por segundo

# ---- combate ----
RED_SIGHT_MUL = 7.0
BLUE_SIGHT_MUL = 8.0
FIRE_MISS_SPREAD = 0.25      # dispersao do tiro que erra (rad)
SUPPRESS_TIME = 0.6
FLASH_TIME = 0.08
TRACER_DECAY = 5.0
RED_ACC_COVER = 0.34
RED_ACC_MOVE = 0.26
BLUE_ACC = 0.42
RED_CD_COVER = (0.5, 0.9)
RED_CD_MOVE = (0.7, 1.2)
BLUE_CD = (0.45, 0.85)

# ---- bounding overwatch (atacantes) ----
BOUND_SET_TIME = (0.9, 1.5)
BOUND_MOVE_TIME = (1.6, 2.4)
BOUND_INIT_JITTER = (0.0, 2.0)

# ---- cobertura ----
COVER_RADIUS = 3             # raio de busca de quina (celulas)

# ---- captura do nucleo ----
CORE_ATTACK_RADIUS_MUL = 2.2
CORE_DEFEND_RADIUS_MUL = 4.0
CORE_CAPTURE_RATE = 0.4
CORE_DECAY_RATE = 0.6
CORE_THREAT_THRESHOLD = 0.1

# ---- defesa de posto ----
POST_DEADZONE_MUL = 0.5      # so volta ao posto se afastar alem disto
BLUE_STRAFE_MUL = 0.25

# ---- tecnicas de ataque (rotulo de cada atacante) ----
ATK_TYPES = [
    "SQLi", "XSS", "RCE", "IDOR", "SSRF", "CSRF",
    "XXE", "AUTH BYPASS", "PATH TRAV", "PRIV ESC",
]
