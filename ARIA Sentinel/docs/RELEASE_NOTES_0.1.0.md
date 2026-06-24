# ARIA Sentinel 0.1.0 Release Notes

Date: 2026-06-19  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.0 is a no-cost, unsigned Windows MVP with a Chromium extension companion. It is ready for local internal testing and demo walkthroughs. It is not yet ready for broad enterprise deployment because code signing, MSI/Intune packaging, live ServiceNow OAuth, encrypted KB storage, production rollback validation, legal review and external security testing are still pending.

## Shipped

- Windows Electron prototype with tray, overlay, settings, local bridge and dry-run recipe runner.
- Canonical TypeScript desktop core under `apps/sentinel-desktop/`.
- Manifest V3 Chromium extension under both the prototype folder and canonical extension folder.
- Content-blind sanitizer, ephemeral buffer, symbolic state dictionary, policy overlay parser and tamper-evident audit log scaffold.
- Pull-only public endpoints for recipes, stop codes, KB bundle and binary update metadata.
- Outcome-only `aria-recipe-feedback` endpoint that rejects extra fields.
- 25 MVP recipes and 25 Windows stop-code mappings.
- Sentinel product SKUs added to the existing catalog/plans/Stripe setup scaffolds.
- Public docs scaffold at `/aria-sentinel/docs/`.
- Customer audit dashboard scaffold at `/sentinel-admin/`.
- GitHub Actions release gate workflow for Sentinel content-leak, policy-injection, prototype, smoke, classifier and dependency audit checks.

## Safety Defaults

- Manual mode is the default install mode.
- OS-changing actions are dry-run by default unless `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1` is deliberately set.
- Raw endpoint/user content is not sent to AI APIs.
- Browser extension storage is limited to symbolic signal and origin category.
- ServiceNow live posting remains disabled until customer OAuth configuration exists.

## Release Artifacts

- `dist/ARIA-Sentinel-0.1.0-unsigned.exe`
- `dist/ARIA-Sentinel-0.1.0-unsigned.exe.blockmap`
- `docs/RELEASE_MANIFEST_0.1.0.json`
- `docs/SBOM-LITE-0.1.0.json`
- `docs/SECURITY_DISCLOSURE_ADDENDUM.md`

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path.
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
