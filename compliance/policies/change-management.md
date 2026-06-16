# Change Management Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual

## Purpose

Ensure changes to ARIA infrastructure, applications, and data are authorized, tested, documented, and reversible. Aligned with SOC 2 CC8.1, NIST SP 800-128.

## Scope

Production systems: iisupp.net, ARIA droplet, Postgres database, Netlify config, DNS, Stripe, sub-processor connections.

## Change categories

### Standard changes (pre-approved)
- KB article additions / edits via bundle rebuild.
- Symbolic state dictionary updates.
- Bug fixes with no architectural change.
- Dependency patch upgrades within semver minor.
- Documentation updates.

**Process:** git PR → automated tests (Dependabot, CodeQL) → merge → loop-engineer qa-safety-loop review → deploy via Netlify auto-build → manual publish.

### Normal changes
- New features.
- Schema migrations.
- New sub-processor onboarding.
- Major version dependency upgrades.
- Authentication / authorization changes.

**Process:** spec → PR → review → preview deploy → staging test → CISO approval → production deploy → publish.

### Emergency changes
- Security patches (zero-day, critical CVE).
- Incident response remediation.
- Service outage recovery.

**Process:** verbal CISO approval → immediate fix → documentation within 24 hours → post-deploy review within 48 hours.

## Approval matrix

| Change type | Approver |
|---|---|
| KB / docs / standard | Cowork (autonomous) + loop-engineer gate |
| New feature / connector | CISO (Ahmad) |
| Auth / sec / data classification | CISO |
| Sub-processor add | CISO |
| Pricing public change | CISO |
| Emergency / incident-driven | CISO (verbal OK, doc within 24h) |
| Multi-tenant data model | CISO |
| Production secret rotation | CISO |

## Change documentation

Every change records in git:
- Commit message with agent prefix (`[kb-agent]`, `[ops-agent]`, `[ccode]`).
- Description of what + why.
- Reference to spec / packet / ticket if applicable.
- Co-Authored-By Claude / Codex attribution.

Major changes additionally documented in `senior-director-state/` + memory.

## Testing requirements

- **Unit tests:** required for any code change.
- **Integration tests:** required for any cross-component change.
- **Preview deploy:** required for any production-facing change.
- **Staging test:** required for: auth, schema, payments, multi-tenant.
- **Smoke test post-deploy:** required for every production deploy.

## Rollback strategy

- **Git:** every change has an immediate revert path (`git revert`).
- **Netlify:** atomic deploy rollback to any previous deploy in seconds.
- **Database migration:** every migration has a documented down-migration (where possible) or restore-from-snapshot path.
- **Sub-processor change:** previous config retained for 90 days.

## Communication

- **Customer-facing changes:** announced 14 days in advance for non-breaking; 30 days for breaking.
- **Maintenance windows:** Mid-Size+ customers notified 7 days in advance.
- **Emergency:** immediate notification post-resolution.

## Records

- All changes logged in git history.
- Production deploys logged to Aperture.
- Change audit reviewable on customer request (Mid-Size+ tier).

## Related

- `compliance/policies/incident-response.md`
- `compliance/SOC2-controls-self-assessment.md` CC8.1
- `docs/LOOP-ENGINEER.md`
