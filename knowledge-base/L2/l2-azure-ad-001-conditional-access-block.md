---
id: l2-azure-ad-001
title: "Conditional Access blocking sign-in (AADSTS53003 / 53000)"
category: azure-ad
support_level: L2
severity: high
estimated_time_minutes: 30
audience: admin
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: ["Entra Conditional Access Administrator", "Sign-in Logs reader"]
keywords:
  - conditional access
  - aadsts53003
  - aadsts53000
  - access blocked
  - compliant device required
  - mfa policy
  - locations
  - blocked by policy
related_articles:
  - l1-m365-001
  - l2-intune-001
  - l3-security-001
escalation_trigger: "Policy change required affecting >10 users, or break-glass account also blocked, or signs of token replay attack"
last_updated: 2026-05-07
version: 1.0
---

# Conditional Access blocking sign-in

## 1. Symptoms
- AADSTS53003: "Access has been blocked by Conditional Access policies."
- AADSTS53000: "Your device must be compliant."
- AADSTS50158: "External security challenge not satisfied."
- Sign-in works on managed device, fails on personal device.
- Sign-in works on corporate network, fails from home.

## 2. Likely Causes
1. Policy targets a group user shouldn't be in, or excludes a group they should be in.
2. Device not joined / not compliant per Intune evaluation.
3. Location-based block (country, IP).
4. App targeting includes app user is signing in to.
5. Session control (Sign-in frequency, persistent browser) tripping.
6. New policy deployed in last 24h.

## 3. Questions To Ask
1. UPN, exact error code, timestamp, app, device name, source IP?
2. Is device Azure AD joined / compliant per Intune?
3. Is user in a CA-targeted or excluded group recently?
4. Did any CA policy change in last 7 days (audit log)?

## 4. Troubleshooting Steps
1. Entra portal → Sign-in logs → filter by user + last 1h → click failed sign-in.
2. Open "Conditional Access" tab on the failed sign-in → identify which policy enforced the block.
3. Note "Result" column for each policy: Success, Failure, Not Applied, etc.
4. Open the offending policy → review users, conditions (locations, devices), grant controls.

## 5. Resolution Steps
**Device not compliant:**
- Have user open Company Portal → Check status. Resolve any flagged item (encryption, updates).
- Or: temporarily exclude user from policy for break-fix; re-include after device fixed.

**Policy misconfiguration (target/exclude wrong):**
- Edit policy → Users → adjust group inclusion/exclusion.
- Bring up CA "What If" tool to verify before save.

**Location-based block (legitimate user travel):**
- Add the user's country to a Trusted Locations or excluded location for the policy.

**Break-glass scenario:**
- Use the documented break-glass account (always excluded from all CA policies) to make the change.
- After fix, audit-log the use.

**Token theft suspicion:**
- Revoke sessions: `Revoke-MgUserSignInSession -UserId <id>`.
- Reset password.
- Investigate sign-in logs for foreign IPs / devices.

## 6. Verification Steps
- User signs in successfully and CA tab on the success record shows policies = Success.
- "What If" tool returns Allow for user/app/location combination.
- No new failures in 24h.

## 7. Escalation Trigger
- Policy change must affect >10 users — coordinate with security team.
- Break-glass account also failing.
- Token theft / unusual locations across multiple users (incident).
- → Escalate to **L3 / Security**.

## 8. Prevention Tips
- Always test new CA policies in Report-only mode for 1 week first.
- Maintain at least two break-glass accounts (different MFA, MFA-excluded, monitored).
- Document every policy's rationale.
- Tag policies with owner.
- Monthly policy review.

## 9. User-Friendly Explanation
"A security rule blocked your sign-in because something didn't match what we require — usually it's that your device isn't checked in as managed, or you're in a place we don't expect you. We'll find which rule and fix it for you."

## 10. Internal Technician Notes
- "What If" tool: Entra → Conditional Access → What If — simulate user/app/IP/device and see policies that apply.
- Sign-in log JSON: download for L3 forensics. Look at `conditionalAccessStatus`, `appliedConditionalAccessPolicies[]`.
- Policy audit log: Entra → Audit logs → Service = Conditional Access. Tracks who changed what when.
- Common AADSTS:
  - 53003 — blocked by CA grant control.
  - 53000 — device required compliant.
  - 53002 — app must be approved client app.
  - 50158 — external security challenge (e.g., MFA required by partner).
- Authentication strength (FIDO2 / passkey only) policies: ensure user has registered the required strength method.

## 11. Related KB Articles
- l1-m365-001 — Can't sign in
- l2-intune-001 — Device compliance not reporting
- l3-security-001 — Identity incident response

## 12. Keywords / Search Tags
conditional access, aadsts53003, aadsts53000, access blocked, compliant device required, mfa policy, locations
