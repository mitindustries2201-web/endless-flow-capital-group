from __future__ import annotations

import ipaddress
import socket
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

BLOCKED_NETS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
]


def is_public_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if addr.is_loopback or addr.is_private or addr.is_link_local or addr.is_multicast or addr.is_unspecified or addr.is_reserved:
        return False
    for net in BLOCKED_NETS:
        if addr in net:
            return False
    return True


def resolve_public_ips(host: str) -> list[str]:
    infos = socket.getaddrinfo(host, None)
    ips = []
    for info in infos:
        ip = info[4][0]
        if not is_public_ip(ip):
            raise ValueError("blocked_destination")
        ips.append(ip)
    if not ips:
        raise ValueError("unresolved_host")
    return ips


def validate_url(url: str, allowed_domains: list[str], allow_http_test_urls: bool = False) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"https", "http"}:
        raise ValueError("invalid_scheme")
    if parsed.scheme == "http" and not allow_http_test_urls:
        raise ValueError("https_required")
    if not parsed.hostname:
        raise ValueError("missing_host")
    host = parsed.hostname.lower()
    if host in {"localhost"}:
        raise ValueError("blocked_destination")
    if not any(host == d or host.endswith("." + d) for d in allowed_domains):
        raise ValueError("domain_not_allowed")
    resolve_public_ips(host)


class FixedWindowLimiter:
    def __init__(self) -> None:
        self._ip_events = defaultdict(deque)

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=window_seconds)
        bucket = self._ip_events[key]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True
