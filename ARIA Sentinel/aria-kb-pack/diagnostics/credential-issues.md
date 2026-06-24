# Credential & Sign-in Issues

## Symptom: User cannot sign in due to password, lockout, or MFA problems.
> User phrasings: "forgot password", "account locked out", "mfa not working", "can't sign in"

### Cause: Account lockout from failed retries
**Probability:** 22%
**Detection:** "Account locked" message after several attempts; check system-context.json `identity.lockoutState` flag.
**Safe diagnostic:** Confirm lockout vs wrong-password by reviewing the sign-in error text (read-only).
**Safe fix:** With user confirmation, wait out the lockout window or request an admin unlock through the proper channel.
**Escalation:** If lockouts repeat without user error, escalate to identity admin to find the lockout source.

### Cause: Expired password
**Probability:** 20%
**Detection:** "Your password has expired" prompt; check system-context.json `identity.passwordExpiry` past due.
**Safe diagnostic:** Confirm the expiry notice and last-change date (read-only).
**Safe fix:** With user confirmation, guide the user through the standard password-change flow meeting complexity rules.
**Escalation:** If the change flow is unavailable, escalate to identity admin for a reset.

### Cause: MFA device or time drift
**Probability:** 18%
**Detection:** Authenticator codes rejected; check system-context.json `time.clockSkewSeconds` for significant drift.
**Safe diagnostic:** Verify the authenticator device's clock and the PC clock are accurate (read-only).
**Safe fix:** With user confirmation, sync device time (enable automatic time) and retry, or use a backup approval method.
**Escalation:** If the MFA device is lost or unenrollable, escalate to identity admin for re-enrollment.

### Cause: Cached credential mismatch
**Probability:** 16%
**Detection:** App prompts repeatedly despite correct password; check system-context.json `identity.credManagerStale` flag.
**Safe diagnostic:** Review stored entries in Windows Credential Manager (read-only).
**Safe fix:** With user confirmation, remove the stale cached credential so the app re-prompts and re-caches.
**Escalation:** If the mismatch persists, escalate to L2 / identity admin.

### Cause: Azure AD / domain trust problem
**Probability:** 14%
**Detection:** "The trust relationship failed" or no domain reachable; check system-context.json `identity.domainTrust` and `network.dcReachable`.
**Safe diagnostic:** Confirm domain/AAD reachability and the device's join status (read-only).
**Safe fix:** With user confirmation and connectivity restored, retry sign-in; do not rejoin the domain without admin approval.
**Escalation:** If trust is broken, escalate to domain admin to repair the secure channel or re-join.

### Cause: Windows Hello / PIN issue
**Probability:** 10%
**Detection:** PIN rejected while password works; check system-context.json `identity.helloError` flag.
**Safe diagnostic:** Confirm the PIN fails but the account password succeeds (read-only).
**Safe fix:** With user confirmation, use "I forgot my PIN" to reset Windows Hello after a successful password sign-in.
**Escalation:** If Hello setup keeps failing, escalate to L2 for TPM / credential-provider checks.
