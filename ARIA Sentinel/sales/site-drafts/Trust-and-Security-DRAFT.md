# Trust & Security — ARIA / Integrated IT Support Inc.
*Draft for iisupp.net (not yet published). 100% accurate — claims only what is real today (RULE 14).*

## Our approach: safety-first, by design
ARIA is built to act on your systems carefully. Every potentially-impactful action is governed, not assumed.

- **Read-only first.** Connectors (directory, ITSM, CRM) start read-only. Write access is never on by default.
- **Never autonomous on a write.** Any change is proposed → approved → executed → **read back to verify it landed** → auto-rollback on mismatch.
- **Human kill-switch.** ARIA Sentinel has an always-available stop (Ctrl+Alt+K) and a dry-run mode.
- **Least privilege.** Integrations request the minimum scopes needed (e.g., Microsoft Entra read scopes only until you grant more).
- **Identity verification is delegated.** End-user identity is confirmed through your trusted verifier (PingOne / RSA / your portal). **ARIA never handles ID photos or biometrics.**
- **Tamper-evident audit.** Actions are logged for review.
- **Local-first data.** ARIA Sentinel runs on the endpoint; sensitive memory is stored locally and encrypted.

## Honest compliance status (we will never overstate this)
- ARIA / Integrated IT Support Inc. is **not currently SOC 2, ISO 27001, or HIPAA certified.**
- We follow the security controls described above and intend to pursue formal certification as we scale.
- We will **never** claim a certification we do not hold, a customer we do not have, or a metric we have not measured.

## Data handling
- You control your connectors and credentials; you can disconnect any integration at any time.
- Credentials are stored in secure local configuration, never emailed or sent in plain text.
- We do not sell customer data.

## Reporting a security concern
Email **ahmad.wasee@iisupp.net** or call **647-581-3182**. Book a security review: [Appointment](https://calendar.app.google/LUyV5pHxkqJRg5vp8).

*Last reviewed: 2026-06-25. This page reflects current, real capabilities and will be updated as they change.*
