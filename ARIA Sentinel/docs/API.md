# ARIA Sentinel — API v1

Read-only events + webhook subscribe. **Bearer auth** uses your license key. Every payload is a
content-blind `telemetry-event-v1` record — recipe id · outcome · opaque endpoint handle · duration ·
ISO timestamp. No page content, file names, URLs or user strings ever cross the API.

Base: `https://iisupp.net/aria-api/v1`

## Auth
```
Authorization: Bearer <your-license-key>
```
- `401` — missing or unrecognized bearer token
- `403` — authentic token but the trial/subscription has expired
- `429` — more than 60 requests/minute

## GET /aria-api/v1/events
Returns recent content-blind fix events.
```bash
curl -s https://iisupp.net/aria-api/v1/events \
  -H "Authorization: Bearer $ARIA_LICENSE_KEY"
```
```json
{
  "v": "telemetry-event-v1",
  "count": 1,
  "events": [
    { "v": "telemetry-event-v1", "recipeId": "dns-fail-v1", "signal": "NET.DNS.FAIL",
      "outcome": "applied", "endpoint": "ep-3k2m9x1", "tier": "green",
      "durationMs": 1200, "ts": "2026-06-19T12:00:00.000Z" }
  ]
}
```

## POST /aria-api/v1/webhooks
Subscribe a URL to receive content-blind events as they happen.
```bash
curl -s -X POST https://iisupp.net/aria-api/v1/webhooks \
  -H "Authorization: Bearer $ARIA_LICENSE_KEY" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com/aria-hook"}'
```
```json
{ "ok": true, "subscribed": true }
```

## Notes
- `telemetry-event-v1` is the same schema the weekly digest, Slack/Teams notify and fleet view consume.
- Endpoint handles are stable but non-reversible (FNV-1a) — you can group by endpoint without ever learning the machine name.
- Rate limit: 60 req/min/token (sliding window).
