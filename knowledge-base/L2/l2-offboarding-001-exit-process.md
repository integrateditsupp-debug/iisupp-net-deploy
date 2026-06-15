---
id: l2-offboarding-001
title: "User offboarding: identity disable, data preservation, license recovery"
category: onboarding
support_level: L2
severity: high
estimated_time_minutes: 45
audience: admin
prerequisites: ["Entra User Admin", "Exchange Admin", "License admin"]
os_scope: ["All"]
keywords:
  - offboarding
  - termination
  - exit
  - disable account
  - litigation hold
  - shared mailbox
  - license reclaim
  - sessions revoked
related_articles:
  - l2-onboarding-001
  - l3-security-001
escalation_trigger: "Hostile termination, regulated industry retention, or executive/privileged user"
last_updated: 2026-05-07
version: 1.0
---

# User offboarding

## 1. Trigger
- HR notifies (planned) or security incident (immediate).

## 2. Sequence (immediate offboarding for hostile/security)
1. **Disable account** (don't delete).
2. **Revoke all sessions** — `Revoke-MgUserSignInSession`.
3. **Reset password** to long random — prevents re-auth via cached.
4. **Remove from privileged groups.**
5. **Block sign-in to Microsoft 365** — Entra → user → Block sign-in.
6. **Wipe / retire device** via Intune — wipe for hostile, retire for amicable.
7. **Notify SOC / Security** if elevated privileges.

## 3. Standard offboarding (planned, last day)
1. Last day at end of business: disable account.
2. Revoke sessions, reset password.
3. Convert mailbox to shared (within 30 days for free retention; otherwise license stays for 30d).
4. Set out-of-office "I no longer work at X — please contact Y".
5. Delegate inbox to manager (read-only).
6. OneDrive: transfer ownership to manager (Entra → user → OneDrive → "Get access to files").
7. Remove from license group → license auto-reclaims after group-based reconciliation.
8. Remove from groups, DLs, ACLs.
9. Place mailbox + OneDrive on Litigation/In-Place Hold per retention policy (typically 90d–7y).
10. Document everything in ticket.

## 4. Day +30
- Confirm shared mailbox conversion sticking.
- Confirm OneDrive contents migrated to manager / archive.
- Confirm device returned & wiped.
- Final review: privileged-access checks confirm no orphan grants.

## 5. Verification
- User cannot sign in (test from incognito).
- License reclaimed in M365 admin.
- Manager has access to former mailbox + OneDrive.
- All groups removed.
- Audit log captures the offboarding actions.

## 6. Escalation
- Hostile termination, regulated industry, or possible IP theft → L3 / Security / Legal.

## 7. Prevention / Quality
- Run quarterly orphan-account scan: disabled >180 days → delete.
- Use Entra ID Governance access packages — auto-revoke on offboarding.
- Document hold requirements per business / jurisdiction.
- Pre-built runbook saves time on hostile exits.

## 8. Notes
- Mailbox conversion to shared requires <50 GB; otherwise keep licensed.
- Litigation hold: `Set-Mailbox -LitigationHoldEnabled $true -LitigationHoldDuration <days>`.
- Session revocation is critical — without it, attacker with refresh token can persist.
- For BYOD, retire (don't wipe) preserves personal data.

## 9. Related
- l2-onboarding-001 — Mirror process
- l3-security-001 — Hostile-exit incident response

## 10. Keywords
offboarding, termination, exit, disable account, litigation hold, shared mailbox, license reclaim, sessions revoked
