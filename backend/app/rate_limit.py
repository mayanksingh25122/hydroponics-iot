"""Shared slowapi Limiter instance for unauthenticated authentication
endpoints (POST /api/v1/auth/register, POST /api/v1/auth/login).

A single module so app.main (which registers this instance on the
FastAPI app and wires its exception handler) and
app.api.v1.routes.auth (which applies @limiter.limit(...) to the two
routes) share exactly one Limiter, rather than each constructing its
own — two separate instances would each keep their own independent
counters and neither would actually enforce the intended limit.

Storage: in-memory (slowapi's default), keyed by client IP
(get_remote_address, i.e. request.client.host). This is a deliberate,
explicitly-scoped choice for VERDA's current single-instance Render
deployment (render.yaml declares one web service, no autoscaling) —
see this module's own limitation notes below, and the task's final
report, for what breaks if that assumption ever stops holding.

KNOWN LIMITATION 1 — multi-instance deployments. In-memory storage is
per-process: if this backend ever runs as more than one instance (a
second Render dyno, autoscaling, a blue/green deploy overlap), each
instance enforces its OWN counter, and the effective limit becomes
(configured limit) x (instance count) instead of the intended global
limit. Moving to a shared backend (slowapi supports Redis via a
storage_uri, with no change to the @limiter.limit(...) call sites)
would be required before scaling past one instance.

KNOWN LIMITATION 2 — client IP identity behind Render's edge proxy,
RESOLVED (deliberately, not by omission — read before "fixing" this).

get_remote_address reads request.client.host: the raw ASGI transport
peer address as uvicorn sees it, with NO header parsing anywhere in
this module or in main.py — no ProxyHeadersMiddleware is installed,
and render.yaml's startCommand passes uvicorn neither --proxy-headers
nor --forwarded-allow-ips. This is intentional, for a reason specific
to Render's own documented proxy behavior, not an oversight:

  1. Render confirms a web service's container is NEVER directly
     reachable from the public internet — the only path in is through
     Render's own load balancer, which terminates TLS and forwards
     over HTTP. So the raw TCP peer uvicorn sees is always Render's
     own infrastructure, never an arbitrary internet host — this
     value cannot be forged by a client, because a client has no way
     to originate a connection uvicorn would see directly.
     https://render.com/docs/web-services

  2. Render's own staff have confirmed their proxy does NOT reset or
     sanitize an inbound X-Forwarded-For header — it only APPENDS its
     own hop to whatever a client already sent:
     https://feedback.render.com/features/p/send-the-correct-xforwardedfor
     https://community.render.com/t/accessing-client-ips-in-a-node-express-app/36282
     This means trusting X-Forwarded-For here — at ANY trusted_hosts
     configuration, including a scoped one naming Render's own proxy
     address specifically, not just a wildcard — would let any client
     set X-Forwarded-For: <anything>, and have that spoofed value
     believed as the "real" client for rate-limiting purposes, because
     uvicorn's own ProxyHeadersMiddleware (see its docstring/source)
     walks the header from the END looking for the first hop NOT in
     the trusted set, which is exactly the client-supplied, unverified
     prefix Render passes through untouched. There is no scoping of
     trusted_hosts that fixes this — the vulnerability is in what the
     header contains, not in who last touched it.

CONCLUSION: the current implementation (ignore X-Forwarded-For
entirely; use only the raw transport peer) is the SAFE choice and is
left unchanged. It is not spoofable by any external client — verified
by test_rate_limit_ignores_spoofed_forwarded_headers in
tests/test_rate_limiting.py, which confirms an attacker-supplied
X-Forwarded-For cannot split or bypass either limiter bucket.

ACCEPTED TRADEOFF, not a bug: because the container is only ever
reached through Render's own infrastructure and no proxy header is
trusted, requests arriving through Render's edge will appear to this
app as coming from a small, shared set of Render-operated addresses
rather than distinct end-user IPs — so in production, the configured
limits (5/hour register, 10/minute login) function closer to a GLOBAL
limit across all users behind that edge than a true per-client one.
This is the safe failure direction (over-restrictive, never a bypass)
and was not "fixed" by trusting a spoofable header instead. If true
per-client limiting is ever required on Render specifically, the
correct fix is a first-party edge/WAF rate limiter in front of the
app (out of scope here — no DNS/edge changes were authorized for this
task), or limiting by authenticated identity (e.g. by email) rather
than by IP.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
