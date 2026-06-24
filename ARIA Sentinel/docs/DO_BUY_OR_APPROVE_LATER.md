# Do Buy Or Approve Later

These items are intentionally not completed in the no-cost MVP.

## Paid or approval-required

- Windows code-signing certificate for production installer reputation.
- Microsoft Partner Center account if distributing through Microsoft Store.
- Chrome Web Store developer registration fee before public listing.
- ServiceNow developer/customer instance OAuth app for live incident create/list/comment.
- Stripe account keys and real Sentinel price IDs for `sentinel_personal_m`, `sentinel_personal_y` and `sentinel_business_y`.
- Resend or approved email provider key for production magic links, handoffs and reminders.
- Netlify Blobs site ID/token for server-side cost tracker persistence.
- Durable store for fleet recipe circuit-breaker counters.
- Enterprise MDM/GPO signing and MSI packaging validation.
- Future external AI reasoning architecture only after privacy review; Sentinel must not send raw endpoint/user content to AI APIs.
- Azure Key Vault, Intune, or customer secret vault integration for enterprise deployment.
- External security audit / penetration test before large enterprise procurement.
- Legal review for enterprise EULA, DPA, privacy policy and support SLA.
- Formal CycloneDX/SPDX SBOM generation and signing if required by an enterprise procurement process.

## Free but still approval-required

- Production `APERTURE_JWT_SECRET` for magic-link signing.
- Customer-approved ServiceNow assignment group map.
- Customer-approved recipe allow/deny policy before non-dry-run fixes.
- Internal pilot users and test machines for real workflow feedback.
- Full Codex Security multi-agent scan. The skill requires explicit subagent authorization before execution.

## Later engineering work

- Real BCD/WinRE BSOD recovery entry after signing and installer elevation review.
- Encrypted SQLite KB store with machine-bound key.
- Full company-document indexing pipeline.
- MSI packaging, SCCM/Intune deployment profile and silent-install switches.
- Live ServiceNow Table API integration with OAuth refresh-token storage.
- Rollback orchestration beyond Windows restore point indicators.
- Multi-monitor edge-hugging physics with per-display bounds.
- Performance profiling target: idle overlay under 1% CPU.
- Managed enterprise policy file for recipe allow/deny lists.
- SOC 2 style evidence automation for the Sentinel binary and release flow.
