# ARIA Sentinel Release Gates

Audit timestamp: 2026-07-06 22:20 ET

## Prototype Demo Gate

Status: PASS for local demo.

Required:

- Local app launches from workspace package.
- ARIA Chat readable answer flow works.
- Resolution tab Fix It/Fix History works.
- Demo/live capture clearly marked as demo/simulation where no real fix runs.
- No destructive or hidden action.
- Test suite green or failures documented.

## MVP Pilot Gate

Status: LIMITED PASS with exclusions.

Allowed:

- Manual and Confirmed mode for local low/medium-risk fixes.
- Autonomous only for low-risk actions explicitly allowed by policy.
- Office File Safety Net local backup/validation.
- Browser current-origin cache/reload.
- ServiceNow drafts or configured customer-safe integration.

Excluded until complete:

- Account unlock.
- Password reset.
- Secret-question verification.
- Uploaded ID matching.
- Manager notification.
- Live RDP grant.
- Malicious-site override in managed mode.
- Broad unattended remediation.

## Enterprise Pilot Gate

Status: FAIL / NOT READY.

Required before pass:

- Signed Windows installer and update path.
- MSI/Intune/GPO deployment validation.
- Admin RBAC and customer tenancy proof.
- Test-tenant identity flows pass.
- Live policy controls for browser/admin/autonomous actions.
- Observability dashboard backed by real fleet data.
- External security review or pen test plan.
- Legal DPA/EULA/SLA reviewed.
- Customer-approved runbook/action allowlist.

## Production Launch Gate

Status: FAIL / NOT READY.

Required before pass:

- All 36 core modules GREEN or explicitly BLOCKED with approved reason and excluded from product claims.
- All tests pass.
- No fake dry-run successes in user-facing UI.
- Signed binaries and distribution pages live.
- Store submissions complete where used.
- Security/legal/compliance evidence package ready.
- First paid pilot evidence and incident response process complete.

