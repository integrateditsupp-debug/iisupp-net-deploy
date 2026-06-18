"""HTTP client for ARIA public API endpoints."""

from __future__ import annotations

from typing import Any, Literal

import httpx

from .exceptions import ARIAAPIError

DEFAULT_BASE = "https://iisupp.net/.netlify/functions"
PlanTier = Literal["personal", "pro", "small_business", "mid_size", "enterprise"]
Urgency = Literal["normal", "urgent"]
Vote = Literal["up", "down"]


class ARIA:
    """Small typed client that mirrors the Node SDK surface."""

    def __init__(
        self,
        *,
        base: str = DEFAULT_BASE,
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
        async_transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base = base.rstrip("/")
        self.timeout = timeout
        self._transport = transport
        self._async_transport = async_transport

    def _post(self, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base}/{path}"
        with httpx.Client(timeout=self.timeout, transport=self._transport) as client:
            response = client.post(url, json=payload or {})
        return self._decode(path, response)

    async def _apost(self, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base}/{path}"
        async with httpx.AsyncClient(timeout=self.timeout, transport=self._async_transport) as client:
            response = await client.post(url, json=payload or {})
        return self._decode(path, response)

    @staticmethod
    def _decode(path: str, response: httpx.Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError:
            data = {}
        if response.is_error:
            message = str(data.get("error") or response.reason_phrase or "request failed")
            raise ARIAAPIError(path, response.status_code, message, data)
        if isinstance(data, dict):
            return data
        return {"data": data}

    def capture_lead(
        self,
        *,
        name: str,
        email: str,
        company: str | None = None,
        phone: str | None = None,
        message: str | None = None,
        source: str | None = None,
        last_intent: str | None = None,
    ) -> dict[str, Any]:
        return self._post("aria-lead-capture", compact(locals(), drop={"self"}))

    async def acapture_lead(self, **kwargs: Any) -> dict[str, Any]:
        return await self._apost("aria-lead-capture", compact(kwargs))

    def request_handoff(
        self,
        *,
        email: str,
        name: str | None = None,
        chat_summary: str | None = None,
        last_intent: str | None = None,
        urgency: Urgency = "normal",
    ) -> dict[str, Any]:
        return self._post("aria-warm-handoff", compact(locals(), drop={"self"}))

    async def arequest_handoff(self, **kwargs: Any) -> dict[str, Any]:
        return await self._apost("aria-warm-handoff", compact(kwargs))

    def request_screen_share(
        self,
        *,
        email: str,
        name: str | None = None,
        urgency: Urgency = "normal",
        context: str | None = None,
        room_pref: str | None = None,
    ) -> dict[str, Any]:
        return self._post("aria-screenshare-request", compact(locals(), drop={"self"}))

    async def arequest_screen_share(self, **kwargs: Any) -> dict[str, Any]:
        return await self._apost("aria-screenshare-request", compact(kwargs))

    def export_my_data(self, *, email: str) -> dict[str, Any]:
        return self._post("aria-data-export", {"email": email})

    async def aexport_my_data(self, *, email: str) -> dict[str, Any]:
        return await self._apost("aria-data-export", {"email": email})

    def delete_my_account(self, *, email: str, confirm: str = "DELETE-MY-DATA") -> dict[str, Any]:
        return self._post("aria-account-delete", {"email": email, "confirm": confirm})

    async def adelete_my_account(self, *, email: str, confirm: str = "DELETE-MY-DATA") -> dict[str, Any]:
        return await self._apost("aria-account-delete", {"email": email, "confirm": confirm})

    def change_plan(self, *, email: str, new_tier: PlanTier) -> dict[str, Any]:
        return self._post("aria-plan-change", {"email": email, "new_tier": new_tier})

    async def achange_plan(self, *, email: str, new_tier: PlanTier) -> dict[str, Any]:
        return await self._apost("aria-plan-change", {"email": email, "new_tier": new_tier})

    def m365_graph(self, *, action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._post("aria-m365-graph", {"action": action, "params": params or {}})

    async def am365_graph(self, *, action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self._apost("aria-m365-graph", {"action": action, "params": params or {}})

    def request_magic_link(self, email: str) -> dict[str, Any]:
        return self._post("aria-magic-link", {"event": "request", "email": email})

    async def arequest_magic_link(self, email: str) -> dict[str, Any]:
        return await self._apost("aria-magic-link", {"event": "request", "email": email})

    def verify_magic_link(self, token: str) -> dict[str, Any]:
        return self._post("aria-magic-link", {"event": "verify", "token": token})

    async def averify_magic_link(self, token: str) -> dict[str, Any]:
        return await self._apost("aria-magic-link", {"event": "verify", "token": token})

    def feedback(
        self,
        *,
        vote: Vote,
        msg_id: str | None = None,
        text: str | None = None,
        intent: str | None = None,
        comment: str | None = None,
        email: str | None = None,
    ) -> dict[str, Any]:
        return self._post("aria-feedback", compact(locals(), drop={"self"}))

    async def afeedback(self, **kwargs: Any) -> dict[str, Any]:
        return await self._apost("aria-feedback", compact(kwargs))

    def mrr(self) -> dict[str, Any]:
        return self._post("aria-mrr-dashboard", {"event": "snapshot"})

    async def amrr(self) -> dict[str, Any]:
        return await self._apost("aria-mrr-dashboard", {"event": "snapshot"})

    def cost_status(self) -> dict[str, Any]:
        return self._post("aria-cost-tracker", {"event": "status"})

    async def acost_status(self) -> dict[str, Any]:
        return await self._apost("aria-cost-tracker", {"event": "status"})

    def cost_log(
        self,
        *,
        tokens_in: int = 0,
        tokens_out: int = 0,
        model: str | None = None,
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        return self._post("aria-cost-tracker", compact({"event": "log", **locals()}, drop={"self"}))

    async def acost_log(self, **kwargs: Any) -> dict[str, Any]:
        return await self._apost("aria-cost-tracker", compact({"event": "log", **kwargs}))

    def get_memory(self, memory_key: str) -> dict[str, Any]:
        return self._post("aria-session-memory", {"event": "get", "memory_key": memory_key})

    async def aget_memory(self, memory_key: str) -> dict[str, Any]:
        return await self._apost("aria-session-memory", {"event": "get", "memory_key": memory_key})

    def remember_memory(self, **payload: Any) -> dict[str, Any]:
        return self._post("aria-session-memory", {"event": "remember", **compact(payload)})

    async def aremember_memory(self, **payload: Any) -> dict[str, Any]:
        return await self._apost("aria-session-memory", {"event": "remember", **compact(payload)})

    def forget_memory(self, memory_key: str, fields: list[str] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"event": "forget", "memory_key": memory_key}
        if fields is not None:
            payload["fields"] = fields
        return self._post("aria-session-memory", payload)

    async def aforget_memory(self, memory_key: str, fields: list[str] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"event": "forget", "memory_key": memory_key}
        if fields is not None:
            payload["fields"] = fields
        return await self._apost("aria-session-memory", payload)

    def submit_tenant_kb(
        self,
        *,
        tenant_email: str,
        kb_content: str,
        kb_title: str | None = None,
        contact_name: str | None = None,
    ) -> dict[str, Any]:
        return self._post("aria-tenant-kb", compact(locals(), drop={"self"}))

    async def asubmit_tenant_kb(self, **kwargs: Any) -> dict[str, Any]:
        return await self._apost("aria-tenant-kb", compact(kwargs))

    def approval_submit(self, **payload: Any) -> dict[str, Any]:
        return self._post("aria-write-gate", {"event": "request", **compact(payload)})

    async def aapproval_submit(self, **payload: Any) -> dict[str, Any]:
        return await self._apost("aria-write-gate", {"event": "request", **compact(payload)})

    def approval_status(self, request_id: str) -> dict[str, Any]:
        return self._post("aria-write-gate", {"event": "status", "request_id": request_id})

    async def aapproval_status(self, request_id: str) -> dict[str, Any]:
        return await self._apost("aria-write-gate", {"event": "status", "request_id": request_id})

    def approval_approve(self, **payload: Any) -> dict[str, Any]:
        return self._post("aria-write-gate", {"event": "approve", **compact(payload)})

    async def aapproval_approve(self, **payload: Any) -> dict[str, Any]:
        return await self._apost("aria-write-gate", {"event": "approve", **compact(payload)})

    def approval_deny(self, **payload: Any) -> dict[str, Any]:
        return self._post("aria-write-gate", {"event": "deny", **compact(payload)})

    async def aapproval_deny(self, **payload: Any) -> dict[str, Any]:
        return await self._apost("aria-write-gate", {"event": "deny", **compact(payload)})

    def renewal_scan(self, dry_run: bool = False) -> dict[str, Any]:
        return self._post("aria-renewal-reminders", {"event": "scan", "dry_run": bool(dry_run)})

    async def arenewal_scan(self, dry_run: bool = False) -> dict[str, Any]:
        return await self._apost("aria-renewal-reminders", {"event": "scan", "dry_run": bool(dry_run)})


def compact(values: dict[str, Any], *, drop: set[str] | None = None) -> dict[str, Any]:
    drop = drop or set()
    return {key: value for key, value in values.items() if key not in drop and value is not None}
