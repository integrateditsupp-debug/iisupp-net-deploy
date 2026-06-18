# IISupp ARIA Python SDK

Official Python client for the ARIA public API by Integrated IT Support Inc.

## Quick start

```bash
pip install -e sdk/python
```

```python
from iisupp_aria import ARIA

client = ARIA()

lead = client.capture_lead(
    name="Clinic Ops",
    email="ops@example.com",
    company="Example Clinic",
    message="Need help with Microsoft 365 support overflow",
    source="python-sdk",
)

handoff = client.request_handoff(
    email="ops@example.com",
    chat_summary="User needs help triaging Outlook and Teams issues.",
    urgency="normal",
)

stats = client.mrr()
report = client.analytics_snapshot(admin_token="admin-token")
theme = client.white_label_theme("clinic.example")
```

## Async usage

Every public method has an async variant prefixed with `a`.

```python
import asyncio
from iisupp_aria import ARIA

async def main() -> None:
    client = ARIA()
    stats = await client.amrr()
    print(stats)

asyncio.run(main())
```

## Methods

- `capture_lead(...)`
- `request_handoff(...)`
- `request_screen_share(...)`
- `export_my_data(...)`
- `delete_my_account(...)`
- `change_plan(...)`
- `m365_graph(...)`
- `request_magic_link(...)`
- `verify_magic_link(...)`
- `feedback(...)`
- `mrr()`
- `cost_status()`
- `cost_log(...)`
- `get_memory(...)`
- `remember_memory(...)`
- `forget_memory(...)`
- `submit_tenant_kb(...)`
- `approval_submit(...)`
- `approval_status(...)`
- `approval_approve(...)`
- `approval_deny(...)`
- `renewal_scan(...)`
- `analytics_snapshot(...)`
- `analytics_series(...)`
- `winback_scan(...)`
- `coupon_admin(...)`
- `slack_authorize_url(...)`
- `white_label_theme(...)`
- `white_label_set(...)`
- `cost_attribution_summary(...)`
- `breaker_status(...)`

Async variants use the same names prefixed with `a`, for example `acapture_lead(...)`, `amrr()`, and `arenewal_scan(...)`.

## Examples

Runnable examples live in `examples/`:

- `capture_lead.py` stages a sales lead from a script.
- `async_mrr.py` fetches revenue telemetry asynchronously.
- `tenant_kb.py` submits tenant knowledge-base content.

## Development

```bash
python -m pytest sdk/python/tests
```

No PyPI publishing is configured. This package is intended to be installed locally or vendored until a release process is approved.
