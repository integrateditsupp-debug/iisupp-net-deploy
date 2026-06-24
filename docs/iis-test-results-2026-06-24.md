# IIS Industry Test Run 2026-06-24T23:05:21.893Z

Base: https://iisupp.net

PASS   7 WARN   2 FAIL   0 SKIP   1

| ID | Test | Status | Detail |
|---|---|---|---|
| SEC-2 | security.txt at /.well-known/ | PASS | Present |
| SEC-3 | VDP / trust page | PASS | Found: security.html, trust/index.html |
| ACC-1 | routing-accuracy regression (332K corpus) | PASS | Last measured 98.64% (327,647/332,163) per docs/aria-web-159k-results.md |
| CONS-1 | 27-agent consensus | SKIP | MEMORY_DIR env not set or missing |
| CHAOS-1 | Sentinel resilience paths | WARN | Missing in: ARIA Sentinel/src/main.js |
| DRY-1 | 3-mode dry-run safety | PASS | All 3 modes referenced |
| REGEN-1 | regression coverage (0/63) | WARN | 0.0% intents have test ref |
| TRUST-1 | Trust pages exist | PASS | All present |
| WCAG-1 | WCAG 2.2 AA probe (3 pages) | PASS | No static issues |
| AGENT-1 | Industry-test workflow propagated | PASS | 1/5 agent docs reference industry tester |
