# Directory / Identity integration (Q-DIR / Q-DIR+) — build state + gates

**Status (2026-06-25):** Slice-1 buildable scope COMPLETE and 100% green (the identity-tier HARD GATE).
Mock/test-tenant only — **no Entra app is registered and no live tenant is touched.**

## What's built (`ARIA Sentinel/src/shared/directory.mjs`, mirrors `servicenow.mjs`)

- **DirectoryProvider abstraction** — provider-agnostic; `client` adapter is injected (mock in tests, MS Graph
  in prod). Primary = Entra ID (Graph); on-prem AD (LDAPS/PowerShell) and Okta/Google are future seams.
- **Read-only ops (least-privilege `READ_SCOPES`):** `lookupUser`, `resolveTarget`, `accountStatus`,
  `groupMembership`, `listDevices` — all content-blind (opaque `uid-…` refs; no UPN/email/name surfaced).
- **Gated write pipeline** (`performIdentityAction`) for `unlock · reset_password · add_group · remove_group ·
  disable`, each enforcing the **cannot-mess-up protocol**:
  1. **Target certainty** — exactly one match or refuse (no fuzzy-match write, ever).
  2. **Never autonomous** + explicit **admin approval** (Confirmed; `adminRole` required).
  3. **IDV gate** for end-user self-requests; **manager reports-to check** + manager-IDV for delegated requests.
  4. **Execute → read-back verify → auto-rollback on mismatch** + escalate.
  5. **Idempotent** (requestId dedupe) · **least-privilege** per-action write scope · **tamper-evident audit**
     (hash-chained).
  6. **No plaintext password** by email — reset = one-time temp + force-change + secure-link delivery.
  7. **Biometric never reaches ARIA** — `idvResult` consumes only pass/fail; raw selfie/ID/template is refused.
- **Editions / connectors (Q-DIR+ A/E):** Standalone vs Integrated; per-connector toggles
  (`entra · onprem_ad · servicenow · rsa_securid · outlook · dynamics365 · pingone_verify`), off by default.

## R-ONE refinements (N3 + N4)

- **N3 — IDV is MIDDLEMAN ONLY.** ARIA never collects/stores/processes an ID, selfie, or biometric. Like a
  human agent it ROUTES the user to the business's trusted verifier (`routeToVerifier`: PingOne Verify / RSA
  SecurID / business IdP / vetted third-party `vendor_idv`), waits for the pass/fail callback, then runs the
  gated action. `routeToVerifier(...).capturesInAria === false` is the hard invariant — no ARIA-side capture
  form exists. On fail → "contact your manager / contact us" + content-blind ticket.
- **N4 — Secure delivery via the business's OWN Outlook/Exchange stack.** `outlookDelivery` returns an
  `enable_only` descriptor: manager-notify + secure delivery go through whatever the business already runs
  (Proofpoint / Mimecast / native); ARIA only ENABLES the integration, the business's IT configures it. The
  no-plaintext-password rule holds (temp + force-change, or unlock+notify).

## Tests (`ARIA Sentinel/tests/directory.test.mjs`, in `run-all`)

16 groups incl. all REQUIRED failure-injection: network drop mid-write, read-back mismatch → auto-rollback,
ambiguous/wrong target, never-autonomous, admin-approval, IDV verified/unverified, manager reports-to
pass/fail, idempotent replay, no-plaintext-password, biometric-never-reaches-brain, permission-denied,
token-expiry, least-privilege scope, tamper-evident audit. **100% green is the gate; nothing ships red.**

## AHMAD / CUSTOMER-GATED (by design — the gating IS the zero-error guarantee)

- Registering the Entra app + admin consent + scope choice is a tenant-admin action — Ahmad/customer does it.
- Live MS Graph adapter (real `client`) + secure token storage (existing secret pattern) — wire after gate.
- Connect-flow UI in the renderer (mirror the ServiceNow settings panel) — next slice.
- NO write against a real directory without explicit Ahmad approval. Live vendors/tenants are sandbox-only here.

## Next slices (each its own gated, fully-tested recipe)

1. Real Entra Graph `client` adapter (read-only first) + connect UI.
2. Wire writes to the identity recipe tier (stricter than Tier-0) + on-device approval surface.
3. IDV vendor SDK integration (Onfido/Persona-class) — pass/fail only.
4. Outlook/Exchange secure manager-notify delivery; RSA/PingOne/Dynamics connectors.
