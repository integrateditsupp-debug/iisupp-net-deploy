from __future__ import annotations

import json
import asyncio

import httpx
import pytest

from iisupp_aria import ARIA, ARIAAPIError


def test_capture_lead_posts_expected_payload() -> None:
    seen: list[tuple[str, dict[str, object]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, json.loads(request.content)))
        return httpx.Response(200, json={"ok": True, "id": "lead_1"})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    result = client.capture_lead(name="Clinic Ops", email="ops@example.com", source="pytest")

    assert result == {"ok": True, "id": "lead_1"}
    assert seen == [
        (
            "/functions/aria-lead-capture",
            {"name": "Clinic Ops", "email": "ops@example.com", "source": "pytest"},
        )
    ]


def test_error_response_raises_api_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "cap reached"})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))

    with pytest.raises(ARIAAPIError) as exc:
        client.cost_status()

    assert exc.value.status_code == 429
    assert exc.value.path == "aria-cost-tracker"
    assert "cap reached" in str(exc.value)


def test_async_mrr_posts_snapshot_event() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "mrr": 123})

    client = ARIA(base="https://example.test/functions", async_transport=httpx.MockTransport(handler))
    result = asyncio.run(client.amrr())

    assert result == {"ok": True, "mrr": 123}
    assert seen == [{"event": "snapshot"}]


def test_packet_methods_are_available() -> None:
    client = ARIA(base="https://example.test/functions")
    for method_name in [
        "capture_lead",
        "request_handoff",
        "export_my_data",
        "delete_my_account",
        "change_plan",
        "m365_graph",
        "request_magic_link",
        "verify_magic_link",
        "feedback",
        "mrr",
        "cost_status",
        "cost_log",
        "submit_tenant_kb",
        "renewal_scan",
        "acapture_lead",
        "amrr",
    ]:
        assert callable(getattr(client, method_name))
