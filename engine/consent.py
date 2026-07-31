"""Instrumento de consentimento: a espinha legal do WonderShield.

Nenhum scan dispara sem uma autorizacao valida. A autorizacao nao e uma promessa
do operador: e um registro assinado pelo dono do alvo (ou um alvo de treino da
propria plataforma), com escopo e janela de tempo. O motor consulta este modulo
antes de comecar, e recusa fora do escopo ou fora da janela.

A mesma logica existe no banco (funcao `authorize_scan` na migracao), entao a
regra vale em duas camadas: defesa em profundidade.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum


class EngagementStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"
    COMPLETED = "completed"


@dataclass(frozen=True)
class Engagement:
    """Registro de consentimento que amarra um scan a um alvo e janela."""
    id: str
    target_host: str
    allowed_hosts: tuple[str, ...]
    window_start: datetime
    window_end: datetime
    status: EngagementStatus
    consent_token: str
    training: bool = False   # alvo de treino da plataforma, auto-consentido


@dataclass(frozen=True)
class Authorization:
    ok: bool
    reason: str
    engagement_id: str | None = None


def host_in_scope(host: str, allowed: tuple[str, ...]) -> bool:
    h = host.lower().strip().strip(".")
    for a in allowed:
        a = a.lower().strip().strip(".")
        if a and (h == a or h.endswith("." + a)):
            return True
    return False


def authorize(
    engagement: Engagement,
    target_host: str,
    now: datetime | None = None,
    presented_token: str | None = None,
) -> Authorization:
    """Decide se um scan pode disparar. Recusa por padrao."""
    now = now or datetime.now(timezone.utc)
    e = engagement

    if e.training:
        return Authorization(True, "training target (self-authorized)", e.id)

    if e.status != EngagementStatus.ACTIVE:
        return Authorization(False, f"engagement not active (status={e.status.value})", e.id)
    if now < e.window_start:
        return Authorization(False, "outside window: not started", e.id)
    if now > e.window_end:
        return Authorization(False, "outside window: expired", e.id)
    if not host_in_scope(target_host, e.allowed_hosts):
        return Authorization(False, f"target {target_host} out of scope", e.id)
    if presented_token is not None and presented_token != e.consent_token:
        return Authorization(False, "consent token mismatch", e.id)

    return Authorization(True, "authorized", e.id)


def training_engagement(target_host: str = "juice-shop.local") -> Engagement:
    """Alvo de treino da plataforma: consentimento proprio, sempre valido."""
    now = datetime.now(timezone.utc)
    return Engagement(
        id="training",
        target_host=target_host,
        allowed_hosts=(target_host,),
        window_start=now,
        window_end=now,
        status=EngagementStatus.ACTIVE,
        consent_token="",
        training=True,
    )
