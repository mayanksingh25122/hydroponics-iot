import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class DeviceCommunicationError(Exception):
    """Raised when a configured ESP32 cannot complete a command or status request."""


def _device_urls() -> dict[int, str]:
    raw_urls = os.getenv("DEVICE_CONTROL_URLS", "{}")
    try:
        configured_urls = json.loads(raw_urls)
    except json.JSONDecodeError as exc:
        raise DeviceCommunicationError("DEVICE_CONTROL_URLS is not valid JSON") from exc

    if not isinstance(configured_urls, dict):
        raise DeviceCommunicationError("DEVICE_CONTROL_URLS must be a JSON object")

    urls: dict[int, str] = {}
    for device_id, base_url in configured_urls.items():
        try:
            numeric_id = int(device_id)
        except (TypeError, ValueError):
            continue
        if isinstance(base_url, str):
            urls[numeric_id] = base_url.rstrip("/")
    return urls


def _base_url_for(device_id: int) -> str:
    base_url = _device_urls().get(device_id)
    if not base_url:
        raise DeviceCommunicationError("No ESP32 address is configured for this device")

    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise DeviceCommunicationError("Configured ESP32 address is invalid")
    return base_url


def request_device_json(device_id: int, path: str, payload: dict | None = None) -> dict:
    url = f"{_base_url_for(device_id)}{path}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        url,
        data=body,
        method="POST" if body is not None else "GET",
        headers={"Content-Type": "application/json"} if body is not None else {},
    )

    try:
        with urlopen(request, timeout=4) as response:
            response_body = response.read().decode("utf-8")
    except HTTPError as exc:
        raise DeviceCommunicationError(f"ESP32 rejected the request ({exc.code})") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise DeviceCommunicationError("Device unreachable") from exc

    try:
        data = json.loads(response_body)
    except json.JSONDecodeError as exc:
        raise DeviceCommunicationError("ESP32 returned invalid JSON") from exc

    if not isinstance(data, dict):
        raise DeviceCommunicationError("ESP32 returned an invalid response")
    return data
