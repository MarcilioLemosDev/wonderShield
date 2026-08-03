"""Testes do scanner de postura.

As funcoes puras sao testadas direto. A deteccao ponta-a-ponta roda contra um
servidor local com cabecalhos conhecidos (localhost nao passa por proxy, entao o
resultado e deterministico).
"""
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from engine.scanner import _analyze_cookies, _leaks_version, _score, scan


class TestHelpers(unittest.TestCase):
    def test_version_leak(self):
        self.assertTrue(_leaks_version("nginx/1.18.0"))
        self.assertTrue(_leaks_version("Apache/2.4.41 (Ubuntu)"))
        self.assertFalse(_leaks_version("cloudflare"))
        self.assertFalse(_leaks_version(None))

    def test_cookie_flags(self):
        ok, _ = _analyze_cookies(["sid=x; Secure; HttpOnly"])
        self.assertTrue(ok)
        bad, detail = _analyze_cookies(["sid=x; Secure"])
        self.assertFalse(bad)
        self.assertIn("httponly", detail.lower())
        none_ok, _ = _analyze_cookies([])
        self.assertTrue(none_ok)

    def test_score_monotonic(self):
        from engine.scanner import Finding
        strong = [Finding("a", "", "headers", "high", True, "")]
        weak = [Finding("a", "", "headers", "high", False, "")]
        self.assertGreater(_score(strong)[0], _score(weak)[0])


def _make_handler(full: bool):
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            if full:
                self.send_header("Strict-Transport-Security", "max-age=63072000")
                self.send_header("Content-Security-Policy", "default-src 'self'")
                self.send_header("X-Frame-Options", "DENY")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Permissions-Policy", "camera=()")
                self.send_header("Set-Cookie", "sid=abc; Secure; HttpOnly")
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *a):
            pass
    return H


class TestScanIntegration(unittest.TestCase):
    def _serve(self, full: bool) -> tuple[ThreadingHTTPServer, int]:
        srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(full))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return srv, srv.server_address[1]

    def test_hardened_target(self):
        srv, port = self._serve(full=True)
        try:
            report = scan(f"http://127.0.0.1:{port}")
        finally:
            srv.shutdown()
        present = {f.id for f in report.findings if f.present}
        for fid in ("hdr_hsts", "hdr_csp", "hdr_frame", "hdr_nosniff",
                    "hdr_referrer", "hdr_permissions", "cookie_flags"):
            self.assertIn(fid, present, f"{fid} deveria ser detectado presente")

    def test_bare_target(self):
        srv, port = self._serve(full=False)
        try:
            report = scan(f"http://127.0.0.1:{port}")
        finally:
            srv.shutdown()
        missing = {f.id for f in report.findings if not f.present}
        for fid in ("hdr_hsts", "hdr_csp", "hdr_frame", "hdr_nosniff",
                    "hdr_referrer", "hdr_permissions"):
            self.assertIn(fid, missing, f"{fid} deveria ser detectado ausente")
        self.assertLess(report.score, 40)


if __name__ == "__main__":
    unittest.main()
