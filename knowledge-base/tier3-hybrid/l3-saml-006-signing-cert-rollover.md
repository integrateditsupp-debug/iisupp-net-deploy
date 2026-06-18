---
title: SAML signing certificate rollover failure
category: sso-saml
support_level: L3
severity: critical
audience: senior-it
keywords: [saml, signing certificate, sso]
created: 2026-06-18
escalation_trigger: Users are locked out after IdP or SP certificate rollover.
---
# SAML signing certificate rollover failure

## Symptom

The requester reports a sso-saml support issue that matches: saml, signing certificate, sso.

## What ARIA should do first

Compare active signing cert thumbprint, metadata URL, clock skew, and rollback path with app owner approval.

## Guardrails

- Collect only the minimum operational details needed to troubleshoot.
- Do not expose student, patient, employee, or production records in screenshots or notes.
- Do not make privileged changes, production changes, legal claims, or vendor submissions without owner approval.

## Escalation

Escalate when: Users are locked out after IdP or SP certificate rollover.

## Support tier

Default tier: L3. Default severity: critical. Article ID: l3-saml-006-signing-cert-rollover.
