"""Exceptions raised by the IISupp ARIA SDK."""

from __future__ import annotations

from typing import Any


class ARIAError(Exception):
    """Base exception for ARIA SDK failures."""


class ARIAAPIError(ARIAError):
    """Raised when the ARIA API returns a non-2xx response."""

    def __init__(self, path: str, status_code: int, message: str, body: Any | None = None) -> None:
        self.path = path
        self.status_code = status_code
        self.body = body
        super().__init__(f"ARIA {path} {status_code}: {message}")
