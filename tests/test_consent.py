"""Testes da checagem de consentimento do motor."""
import unittest
from datetime import datetime, timedelta, timezone

from engine.consent import (
    Engagement,
    EngagementStatus,
    authorize,
    host_in_scope,
    training_engagement,
)

NOW = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def make(**over):
    base = dict(
        id="e1",
        target_host="app.cliente.com",
        allowed_hosts=("app.cliente.com",),
        window_start=NOW - timedelta(hours=1),
        window_end=NOW + timedelta(hours=1),
        status=EngagementStatus.ACTIVE,
        consent_token="tok-123",
    )
    base.update(over)
    return Engagement(**base)


class TestScope(unittest.TestCase):
    def test_exact_and_subdomain(self):
        self.assertTrue(host_in_scope("app.cliente.com", ("app.cliente.com",)))
        self.assertTrue(host_in_scope("api.app.cliente.com", ("app.cliente.com",)))

    def test_not_sibling_or_suffix_trick(self):
        self.assertFalse(host_in_scope("cliente.com", ("app.cliente.com",)))
        self.assertFalse(host_in_scope("evilcliente.com", ("cliente.com",)))
        self.assertFalse(host_in_scope("app.cliente.com.attacker.net", ("app.cliente.com",)))


class TestAuthorize(unittest.TestCase):
    def test_happy_path(self):
        a = authorize(make(), "app.cliente.com", now=NOW, presented_token="tok-123")
        self.assertTrue(a.ok)

    def test_out_of_scope_refused(self):
        a = authorize(make(), "outro.com", now=NOW)
        self.assertFalse(a.ok)
        self.assertIn("out of scope", a.reason)

    def test_before_window_refused(self):
        a = authorize(make(), "app.cliente.com", now=NOW - timedelta(hours=2))
        self.assertFalse(a.ok)
        self.assertIn("not started", a.reason)

    def test_after_window_refused(self):
        a = authorize(make(), "app.cliente.com", now=NOW + timedelta(hours=2))
        self.assertFalse(a.ok)
        self.assertIn("expired", a.reason)

    def test_non_active_refused(self):
        a = authorize(make(status=EngagementStatus.REVOKED), "app.cliente.com", now=NOW)
        self.assertFalse(a.ok)

    def test_token_mismatch_refused(self):
        a = authorize(make(), "app.cliente.com", now=NOW, presented_token="errado")
        self.assertFalse(a.ok)
        self.assertIn("token", a.reason)

    def test_training_self_authorized(self):
        a = authorize(training_engagement(), "juice-shop.local")
        self.assertTrue(a.ok)
        self.assertIn("training", a.reason)

    def test_default_is_refusal(self):
        # sem janela valida, escopo errado: precisa recusar, nunca liberar por omissao
        a = authorize(make(status=EngagementStatus.PENDING), "outro.com",
                      now=NOW + timedelta(days=10))
        self.assertFalse(a.ok)


if __name__ == "__main__":
    unittest.main()
