"""Scanner de postura (black box, nao-intrusivo).

Nivel 1 do metodo WonderShield: roda em qualquer URL, so faz requisicoes normais
(um GET, como um navegador faria) e analisa a resposta. Nao envia payload, nao
explora, nao ataca. Observa a postura publica: HTTPS, cabecalhos de seguranca,
flags de cookie, exposicao de versao. E legal em qualquer alvo porque nao passa
de olhar o que o servidor entrega a uma visita comum.

Cada achado vira um evento na arena: protecao presente = defesa azul; protecao
ausente = brecha por onde o vermelho avanca. A exploracao ativa (Nivel 2, com
payloads) e outra camada, e exige o engajamento assinado.

Uso:
    python -m engine.scanner https://exemplo.com
"""
from __future__ import annotations

import re
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from http.client import HTTPResponse

UA = "WonderShield-Posture/0.1 (+non-intrusive security posture check)"
TIMEOUT = 15

SEVERITY_WEIGHT = {"high": 5, "medium": 3, "low": 1, "info": 0}


@dataclass
class Finding:
    id: str
    title: str
    category: str      # 'tls' | 'headers' | 'cookies' | 'disclosure'
    severity: str      # 'high' | 'medium' | 'low' | 'info'
    present: bool      # True = protecao presente (azul); False = brecha (vermelho)
    detail: str


@dataclass
class ScanReport:
    url: str
    reachable: bool
    findings: list[Finding]
    score: int         # 0..100, postura geral
    grade: str         # A..F
    error: str = ""


def _fetch(url: str, allow_redirects: bool = True) -> HTTPResponse | None:
    opener = urllib.request.build_opener()
    if not allow_redirects:
        class _NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):
                return None
        opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": UA})
    try:
        return opener.open(req, timeout=TIMEOUT)
    except urllib.error.HTTPError as e:
        return e  # ainda tem headers/status
    except Exception:
        return None


def _leaks_version(server: str | None) -> bool:
    if not server:
        return False
    # "nginx/1.18.0", "Apache/2.4.41" vazam versao; "cloudflare" nao
    return bool(re.search(r"/\d", server) or re.search(r"\d+\.\d+", server))


def _analyze_cookies(cookies: list[str]) -> tuple[bool, str]:
    if not cookies:
        return True, "sem cookies na resposta"
    bad = []
    for c in cookies:
        low = c.lower()
        miss = [f for f in ("secure", "httponly") if f not in low]
        if miss:
            name = c.split("=", 1)[0].strip()
            bad.append(f"{name} sem {', '.join(miss)}")
    if bad:
        return False, "; ".join(bad[:3])
    return True, "todos os cookies com Secure e HttpOnly"


def scan(url: str) -> ScanReport:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    resp = _fetch(url, allow_redirects=True)
    if resp is None:
        return ScanReport(url=url, reachable=False, findings=[], score=0,
                          grade="F", error="alvo inacessivel")

    h = resp.headers
    final_url = resp.geturl()
    findings: list[Finding] = []

    def add(id, title, category, severity, present, detail):
        findings.append(Finding(id, title, category, severity, present, detail))

    # ---- TLS ----
    is_https = final_url.startswith("https://")
    add("tls_https", "Serve por HTTPS", "tls", "high", is_https,
        "conexao cifrada" if is_https else "trafego em texto claro")

    # redirect http -> https
    http_url = "http://" + re.sub(r"^https?://", "", url)
    r2 = _fetch(http_url, allow_redirects=False)
    redirects = False
    if r2 is not None:
        loc = r2.headers.get("Location", "") or ""
        status = getattr(r2, "status", getattr(r2, "code", 0))
        redirects = str(status).startswith("3") and loc.startswith("https://")
    add("tls_redirect", "Redireciona HTTP para HTTPS", "tls", "medium", redirects,
        "forca canal seguro" if redirects else "aceita HTTP sem redirecionar")

    # ---- cabecalhos de seguranca ----
    hsts = h.get("Strict-Transport-Security")
    add("hdr_hsts", "HSTS (Strict-Transport-Security)", "headers", "medium", bool(hsts),
        hsts or "ausente")

    csp = h.get("Content-Security-Policy")
    add("hdr_csp", "Content-Security-Policy", "headers", "high", bool(csp),
        "presente" if csp else "ausente, XSS sem contencao")

    xfo = h.get("X-Frame-Options")
    frame_anc = bool(csp and "frame-ancestors" in csp.lower())
    frame_ok = bool(xfo) or frame_anc
    add("hdr_frame", "Protecao de clickjacking", "headers", "medium", frame_ok,
        (xfo or "frame-ancestors na CSP") if frame_ok else "sem X-Frame-Options nem frame-ancestors")

    nosniff = (h.get("X-Content-Type-Options") or "").lower() == "nosniff"
    add("hdr_nosniff", "X-Content-Type-Options: nosniff", "headers", "low", nosniff,
        "nosniff" if nosniff else "ausente")

    ref = h.get("Referrer-Policy")
    add("hdr_referrer", "Referrer-Policy", "headers", "low", bool(ref), ref or "ausente")

    perm = h.get("Permissions-Policy")
    add("hdr_permissions", "Permissions-Policy", "headers", "low", bool(perm), perm or "ausente")

    # ---- cookies ----
    cookies = h.get_all("Set-Cookie") or []
    ck_ok, ck_detail = _analyze_cookies(cookies)
    add("cookie_flags", "Cookies com Secure e HttpOnly", "cookies", "medium", ck_ok, ck_detail)

    # ---- exposicao de versao ----
    server = h.get("Server")
    leaks = _leaks_version(server) or bool(h.get("X-Powered-By"))
    add("disclosure_server", "Servidor nao expoe versao", "disclosure", "low", not leaks,
        f"expoe: {server or h.get('X-Powered-By')}" if leaks else (server or "sem banner"))

    score, grade = _score(findings)
    return ScanReport(url=final_url, reachable=True, findings=findings, score=score, grade=grade)


def _score(findings: list[Finding]) -> tuple[int, str]:
    total = sum(SEVERITY_WEIGHT[f.severity] for f in findings) or 1
    got = sum(SEVERITY_WEIGHT[f.severity] for f in findings if f.present)
    score = round(100 * got / total)
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F"
    return score, grade


def to_arena(report: ScanReport) -> dict:
    """Traduz os achados no cenario da arena: defesas azuis e brechas vermelhas."""
    defenses = [f.title for f in report.findings if f.present]
    gaps = [{"title": f.title, "severity": f.severity} for f in report.findings if not f.present]
    return {
        "url": report.url,
        "score": report.score,
        "grade": report.grade,
        "defenses": defenses,   # nos que o azul segura
        "gaps": gaps,           # brechas por onde o vermelho avanca
    }


def main():
    if len(sys.argv) < 2:
        print("uso: python -m engine.scanner <url>")
        return
    report = scan(sys.argv[1])
    print(f"\n  {report.url}  ·  postura {report.score}/100 (nota {report.grade})\n")
    for f in report.findings:
        mark = "\033[36m[OK]\033[0m " if f.present else "\033[31m[!!]\033[0m "
        print(f"  {mark} {f.title:38s} {f.detail}")
    arena = to_arena(report)
    print(f"\n  arena: {len(arena['defenses'])} defesas (azul), "
          f"{len(arena['gaps'])} brechas (vermelho)\n")


if __name__ == "__main__":
    main()
