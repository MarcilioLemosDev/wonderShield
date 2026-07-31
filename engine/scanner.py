"""Scanner de postura: black box, nao-intrusivo (Nivel 1).

Roda em qualquer URL porque nao ataca nada: faz requisicoes normais, como um
navegador faria, e analisa a resposta. Cabecalhos de seguranca, flags de cookie,
exposicao de servidor, HTTPS, arquivos publicos. E o que securityheaders.com e
afins fazem em publico.

A exploracao ativa (payloads, fuzzing) e Nivel 2 e NAO mora aqui: exige um
engajamento consentido (engine/consent.py) ou um alvo de treino. Este modulo
nunca envia payload; so observa.

Cada achado tem `passed`: True e uma defesa presente (vira no vermelho segurado
pelo azul na arena), False e uma brecha (vira avanco vermelho).

Uso:
    python -m engine.scanner https://exemplo.com
"""
from __future__ import annotations

import json
import os
import socket
import ssl
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from urllib.parse import urlparse

UA = "WonderShield-Posture/1.0 (+https://wondershield.dev)"

# (chave do header, rotulo, categoria, severidade se ausente)
SECURITY_HEADERS = [
    ("content-security-policy", "Content-Security-Policy", "headers", "high"),
    ("strict-transport-security", "HSTS", "transport", "medium"),
    ("x-frame-options", "X-Frame-Options", "headers", "medium"),
    ("x-content-type-options", "X-Content-Type-Options", "headers", "low"),
    ("referrer-policy", "Referrer-Policy", "headers", "low"),
    ("permissions-policy", "Permissions-Policy", "headers", "low"),
]

SEVERITY_WEIGHT = {"high": 5, "medium": 3, "low": 1, "info": 0}


@dataclass
class Finding:
    id: str
    title: str
    category: str
    severity: str        # 'high' | 'medium' | 'low' | 'info'
    passed: bool         # True: defesa presente | False: brecha
    detail: str


def _context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    # em ambiente com proxy MITM, confia no CA dele; em producao a conexao e direta
    ca = os.environ.get("REQUESTS_CA_BUNDLE") or "/root/.ccr/ca-bundle.crt"
    try:
        if os.path.exists(ca):
            ctx.load_verify_locations(ca)
    except OSError:
        pass
    return ctx


def _fetch(url: str, timeout: int = 12):
    """GET simples. Devolve (url_final, status, headers_list) ou lanca."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=timeout, context=_context())
    return resp.geturl(), resp.status, resp.getheaders()


def _tls_info(host: str, timeout: int = 8):
    """Handshake direto para inspecionar o certificado. Best-effort."""
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            return ssock.getpeercert(), ssock.version()


def _exists(url: str) -> bool:
    try:
        _, status, _ = _fetch(url, timeout=8)
        return 200 <= status < 400
    except Exception:
        return False


def scan(url: str) -> dict:
    if not urlparse(url).scheme:
        url = "https://" + url
    findings: list[Finding] = []

    try:
        final_url, status, header_list = _fetch(url)
    except urllib.error.URLError as e:
        return {"url": url, "error": f"nao foi possivel acessar: {e.reason}", "findings": []}
    except Exception as e:  # noqa: BLE001
        return {"url": url, "error": f"nao foi possivel acessar: {e}", "findings": []}

    headers = {k.lower(): v for k, v in header_list}
    host = urlparse(final_url).hostname or ""

    # HTTPS
    is_https = urlparse(final_url).scheme == "https"
    findings.append(Finding(
        "https", "HTTPS", "transport", "high", is_https,
        "conexao cifrada" if is_https else "site servido sem HTTPS"))

    # cabecalhos de seguranca
    for key, label, cat, sev in SECURITY_HEADERS:
        present = key in headers
        findings.append(Finding(
            key, label, cat, sev, present,
            headers[key][:80] if present else f"cabecalho {label} ausente"))

    # exposicao de servidor / stack
    for key, label in (("server", "Servidor"), ("x-powered-by", "X-Powered-By")):
        if key in headers:
            findings.append(Finding(
                f"disc-{key}", f"{label} exposto", "disclosure", "low", False,
                f"{label}: {headers[key]}"))

    # cookies
    cookies = [v for k, v in header_list if k.lower() == "set-cookie"]
    for i, c in enumerate(cookies):
        low = c.lower()
        name = c.split("=", 1)[0]
        for flag, tag in (("secure", "Secure"), ("httponly", "HttpOnly"), ("samesite", "SameSite")):
            findings.append(Finding(
                f"cookie-{i}-{flag}", f"Cookie {name}: {tag}", "cookies", "medium",
                flag in low, f"cookie '{name}' {'com' if flag in low else 'sem'} {tag}"))

    # arquivos publicos
    base = f"{urlparse(final_url).scheme}://{host}"
    findings.append(Finding(
        "security-txt", "security.txt", "disclosure", "info",
        _exists(base + "/.well-known/security.txt"),
        "canal de contato de seguranca publicado"))

    # TLS (best-effort; pode falhar em rede restrita)
    if is_https and host:
        try:
            _, proto = _tls_info(host)
            weak = proto in ("TLSv1", "TLSv1.1", "SSLv3")
            findings.append(Finding(
                "tls-version", f"TLS {proto}", "transport", "medium", not weak,
                f"protocolo {proto}" + (" (fraco)" if weak else "")))
        except Exception:
            findings.append(Finding(
                "tls-version", "TLS", "transport", "info", True,
                "protocolo nao avaliado neste ambiente"))

    passed = sum(1 for f in findings if f.passed)
    gaps = [f for f in findings if not f.passed]
    weight = sum(SEVERITY_WEIGHT[f.severity] for f in gaps)
    max_weight = sum(SEVERITY_WEIGHT[f.severity] for f in findings if f.severity != "info") or 1
    score = max(0, round(100 * (1 - weight / max_weight)))

    return {
        "url": url,
        "final_url": final_url,
        "status": status,
        "score": score,
        "summary": {
            "total": len(findings),
            "passed": passed,
            "gaps": len(gaps),
            "high": sum(1 for f in gaps if f.severity == "high"),
            "medium": sum(1 for f in gaps if f.severity == "medium"),
            "low": sum(1 for f in gaps if f.severity == "low"),
        },
        "findings": [asdict(f) for f in findings],
    }


def main():
    if len(sys.argv) < 2:
        print("uso: python -m engine.scanner <url>")
        raise SystemExit(1)
    result = scan(sys.argv[1])
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
