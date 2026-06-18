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
        "analytics_snapshot",
        "analytics_series",
        "winback_scan",
        "coupon_admin",
        "slack_authorize_url",
        "white_label_theme",
        "white_label_set",
        "cost_attribution_summary",
        "breaker_status",
        "acapture_lead",
        "amrr",
        "aanalytics_snapshot",
        "awinback_scan",
        "acoupon_admin",
        "aslack_authorize_url",
        "awhite_label_theme",
        "awhite_label_set",
        "acost_attribution_summary",
        "abreaker_status",
    ]:
        assert callable(getattr(client, method_name))


def test_white_label_theme_uses_get_query() -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    result = client.white_label_theme("clinic.example")

    assert result == {"ok": True}
    assert seen == ["https://example.test/functions/aria-white-label?tenant_id=clinic.example&format=json"]


def test_analytics_snapshot_posts_admin_token() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.analytics_snapshot(admin_token="secret")

    assert seen == [{"event": "snapshot", "admin_token": "secret"}]


def test_analytics_series_posts_metric_window() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.analytics_series(metric="deflection", window=7)

    assert seen == [{"event": "series", "metric": "deflection", "window": 7}]


def test_winback_scan_posts_customers() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "candidate_count": 1})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    result = client.winback_scan([{"email": "a@example.com", "days_since_churn": 21}], min_score=20, limit=5)

    assert result["candidate_count"] == 1
    assert seen == [{
        "event": "scan",
        "customers": [{"email": "a@example.com", "days_since_churn": 21}],
        "min_score": 20,
        "limit": 5,
    }]


def test_coupon_admin_upsert_payload() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.coupon_admin(event="upsert", admin_token="secret", coupon={"code": "FOUNDING20", "pct": 20})

    assert seen == [{"event": "upsert", "admin_token": "secret", "coupon": {"code": "FOUNDING20", "pct": 20}}]


def test_slack_authorize_url_payload() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "authorize_url": "https://slack.test"})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    result = client.slack_authorize_url(state="iis")

    assert result["authorize_url"] == "https://slack.test"
    assert seen == [{"event": "authorize_url", "state": "iis"}]


def test_white_label_set_payload() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.white_label_set(tenant_id="clinic.example", theme={"brand_name": "Clinic"}, admin_token="secret")

    assert seen == [{
        "event": "set",
        "tenant_id": "clinic.example",
        "theme": {"brand_name": "Clinic"},
        "admin_token": "secret",
    }]


def test_cost_attribution_summary_drops_none_month() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.cost_attribution_summary(tenant_id="clinic.example")

    assert seen == [{"event": "tenant_summary", "tenant_id": "clinic.example"}]


def test_breaker_status_payload() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "status": {}})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    result = client.breaker_status()

    assert result["status"] == {}
    assert seen == [{"event": "status"}]


def test_async_white_label_theme_uses_get() -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.method + " " + str(request.url))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", async_transport=httpx.MockTransport(handler))
    result = asyncio.run(client.awhite_label_theme("tenant.test"))

    assert result == {"ok": True}
    assert seen == ["GET https://example.test/functions/aria-white-label?tenant_id=tenant.test&format=json"]


def test_async_coupon_admin_payload() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", async_transport=httpx.MockTransport(handler))
    result = asyncio.run(client.acoupon_admin(event="list", admin_token="secret"))

    assert result == {"ok": True}
    assert seen == [{"event": "list", "admin_token": "secret"}]


def test_async_error_response_raises_api_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "upstream down"})

    client = ARIA(base="https://example.test/functions", async_transport=httpx.MockTransport(handler))

    with pytest.raises(ARIAAPIError) as exc:
        asyncio.run(client.abreaker_status())

    assert exc.value.status_code == 503
    assert exc.value.path == "aria-breaker-status"


def test_non_dict_json_response_is_wrapped() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=["a", "b"])

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))

    assert client.breaker_status() == {"data": ["a", "b"]}


def test_empty_success_body_returns_empty_dict() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(204, content=b"")

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))

    assert client.breaker_status() == {}


def test_memory_helpers_payloads() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.remember_memory(memory_key="tenant:user", values={"timezone": "ET"})
    client.forget_memory("tenant:user", fields=["timezone"])

    assert seen == [
        {"event": "remember", "memory_key": "tenant:user", "values": {"timezone": "ET"}},
        {"event": "forget", "memory_key": "tenant:user", "fields": ["timezone"]},
    ]


def test_cost_log_payload_has_event() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    client = ARIA(base="https://example.test/functions", transport=httpx.MockTransport(handler))
    client.cost_log(tokens_in=100, tokens_out=200, model="claude-haiku")

    assert seen == [{"event": "log", "tokens_in": 100, "tokens_out": 200, "model": "claude-haiku"}]
