"""Application-level rate limiting on the two unauthenticated auth
endpoints (see app.rate_limit and the @limiter.limit(...) decorators in
app.api.v1.routes.auth).

conftest.py's autouse _reset_rate_limiter fixture clears the shared
in-memory counters before every test, so each test here starts from
zero regardless of what ran before it.
"""

VALID_PASSWORD = "correct-horse-battery"


def test_register_is_rate_limited_per_ip(client):
    """5/hour on POST /register. The 6th attempt within the window must
    be rejected with 429 before it can even reach the duplicate-email
    check — a different email is used on every call specifically so
    that if the limiter did NOT fire, every one of these would
    otherwise succeed (201), isolating rate-limiting as the only
    possible cause of a non-201 response here.
    """
    statuses = []
    for i in range(6):
        response = client.post(
            "/api/v1/auth/register",
            json={"email": f"limit-test-{i}@example.com", "password": VALID_PASSWORD},
        )
        statuses.append(response.status_code)

    assert statuses[:5] == [201, 201, 201, 201, 201]
    assert statuses[5] == 429


def test_login_is_rate_limited_per_ip(client):
    """10/minute on POST /login. Uses wrong credentials for every
    attempt — the point is that rate limiting kicks in independently of
    whether the credentials would have succeeded, and specifically
    BEFORE the expensive Argon2id verification: authenticate_user
    always runs a full password-hash comparison per attempt (see its
    own docstring on timing-safe behavior), so if the limiter did not
    run first, 11 attempts would all still pay that cost and all still
    return 401, not 429.
    """
    statuses = []
    for _ in range(11):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "wrong-password"},
        )
        statuses.append(response.status_code)

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


def test_rate_limit_response_still_carries_cors_headers(client):
    """A 429 must still be readable by the browser it was meant to
    protect: if CORSMiddleware does not wrap the rate limiter's
    response, the frontend's fetch would fail with an opaque CORS
    error instead of ever seeing the 429 and its message. Exercises the
    exact origin app.settings.CORS_ALLOW_ORIGINS defaults to
    (http://localhost:5173) when unset, matching conftest.py's
    placeholder environment.
    """
    for i in range(5):
        client.post(
            "/api/v1/auth/register",
            json={"email": f"cors-test-{i}@example.com", "password": VALID_PASSWORD},
            headers={"Origin": "http://localhost:5173"},
        )

    limited = client.post(
        "/api/v1/auth/register",
        json={"email": "cors-test-overflow@example.com", "password": VALID_PASSWORD},
        headers={"Origin": "http://localhost:5173"},
    )

    assert limited.status_code == 429
    assert limited.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_register_limit_is_scoped_independently_of_login_limit(client):
    """The two @limiter.limit(...) decorators use independent keys
    (route + client), so exhausting one must not affect the other.
    """
    for i in range(5):
        response = client.post(
            "/api/v1/auth/register",
            json={"email": f"independent-{i}@example.com", "password": VALID_PASSWORD},
        )
        assert response.status_code == 201

    exhausted = client.post(
        "/api/v1/auth/register",
        json={"email": "independent-overflow@example.com", "password": VALID_PASSWORD},
    )
    assert exhausted.status_code == 429

    still_works = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )
    assert still_works.status_code == 401


def test_rate_limit_ignores_spoofed_forwarded_headers(client):
    """The regression this pins down: get_remote_address reads only
    request.client.host (the raw ASGI transport peer) — no
    ProxyHeadersMiddleware is installed and no X-Forwarded-For/Forwarded
    header is ever consulted (see app/rate_limit.py's module docstring
    for why trusting that header would be unsafe specifically on
    Render, which does not sanitize an inbound X-Forwarded-For before
    appending to it).

    Proof: exhaust the register limit while sending a DIFFERENT spoofed
    X-Forwarded-For on every single request. If the app were fooled
    into keying on that header, each distinct spoofed value would get
    its own bucket and every one of these 6 requests would succeed
    (201). Instead they must show exactly the same exhaustion pattern
    as test_register_is_rate_limited_per_ip, which sends no such header
    at all — proving the header is inert here, not merely untested.
    """
    statuses = []
    for i in range(6):
        response = client.post(
            "/api/v1/auth/register",
            json={"email": f"spoof-test-{i}@example.com", "password": VALID_PASSWORD},
            headers={
                # A fresh, distinct forged origin on every request —
                # if this were honored, none of these could ever
                # collide into the same bucket.
                "X-Forwarded-For": f"203.0.113.{i}",
                "Forwarded": f'for="203.0.113.{i}"',
            },
        )
        statuses.append(response.status_code)

    assert statuses[:5] == [201, 201, 201, 201, 201]
    assert statuses[5] == 429
