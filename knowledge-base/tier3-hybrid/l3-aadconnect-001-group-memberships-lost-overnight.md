---
title: Hybrid identity sync failures - AAD Connect
vertical: any
tier: l3
intent_codes: [AADCONNECT.HYBRID, AADCONNECT.FAIL]
keywords: [aadconnect, hybrid, on-prem, cloud, identity, sync]
compliance: []
created: 2026-06-18
escalation_default: partner_referral
---

## Symptom

Users in a hybrid environment lose access, sync drifts, or authentication fails between on-premises and Microsoft 365 / Entra ID. Symptoms vary by service but the root cause is almost always identity sync, certificate trust, or connector misconfiguration.

## What is happening (1-line cause)

A trust boundary between on-prem and cloud has broken: sync object, federation token, soft-match, or certificate chain.

## Fix — try these in order

### 1. Pinpoint which side is the source of truth

Open Entra ID admin center → Hybrid management → check the connector health for **aadconnect**. Note the last successful sync timestamp and any error codes. Compare against the on-prem system event log for the same window. The side that changed first is the trigger.

**Escalation:** if no error visible in either log, ARIA escalates to a senior tech for packet capture (>15 min troubleshoot).

### 2. Force a sync / re-issue the trust

On the on-prem AAD Connect server:
```powershell
Start-ADSyncSyncCycle -PolicyType Delta
Get-ADSyncConnectorRunStatus
```

If the sync completes but the issue persists, escalate trust re-issue:
```powershell
Set-MsolDirSyncEnabled -EnableDirSync $false
# Wait 72 hours then re-enable — destructive, requires Ahmad approval
```

**Escalation:** the second command is destructive. ARIA does NOT execute. Must be approved by tenant admin AND scoped to a maintenance window.

### 3. Verify the cert / federation chain

For SAML / federation issues:
```powershell
Get-MsolFederationProperty -DomainName <yourdomain>
```

Check that the signing cert is not expired and that the federation URL is reachable from the user network. Test from a clean device on a different network if user reports issue from a specific location.

**Escalation:** open ticket with identity vendor (Microsoft / Okta / Ping) with the trace + collect HAR file from the user browser.

## Compliance reminder

Hybrid identity work touches authentication trust. Document every change in the per-tenant audit log via /.netlify/functions/aria-tenant-audit. Schedule changes outside business hours. Notify all users 24h ahead.

## Related entries

- [[l3-aadconnect-001-group-memberships-lost-overnight]]
- [[l3-saml-001-okta-saml-to-salesforce-broken]]
