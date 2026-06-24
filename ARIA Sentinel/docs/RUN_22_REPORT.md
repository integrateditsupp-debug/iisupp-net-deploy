# RUN 22 — Dashboard + Performance + SLA + Compliance + Quarterly Reports + Retention

**Date:** 2026-06-20 · **Suite:** 114 → 136 (all green) · **New deps:** 0 · **Published:** nothing (local commit only)

The presentation layer enterprise procurement evaluates against. Every metric is computed from real
sources, content-blind, and 🔒 R11-safe. Combined with RUN 21, the data, the contract, and the dashboard
align — every number is real, auditable, and shippable to a CFO.

## 1 · Files touched

**New pure/compute modules**
1. `src/shared/metrics.mjs` — operational + AI KPI computations
2. `src/shared/dashboard-status.mjs` — hero status · sparklines · delta arrows · tiles
3. `src/main/sla-tracker.mjs` — tier SLA defaults · uptime/response/resolution · breach credits · HMAC state
4. `src/shared/compliance-score.mjs` — SOC2/HIPAA/PIPEDA/GDPR composites · R11 counter
5. `src/main/data-retention.mjs` — retention policy · cutoffs · legal-hold · R11 exclusion
6. `src/main/report-generator.mjs` — quarter detection · report HTML · content-blind gate
7. `src/shared/quarterly-email.mjs` — subject · content-blind body · opt-in gate
8. `src/shared/fleet-aggregate.mjs` — admin fleet aggregate + cohort SLA

**New renderer tab builders** — 9. `src/renderer/tabs/{dashboard,performance,sla,compliance,reports}.mjs`

**Wiring** — 10. `src/main/main.mjs` (data builders + 7 IPC + report printToPDF + daily-02:00 retention cron + quarterly cron) · 11. `src/main/preload.cjs` (7 methods) · 12. `src/renderer/renderer.js` (tab loaders + wireRun22 + default Overview) · 13. `src/renderer/index.html` (5 nav + 5 panels, Overview default) · 14. `src/renderer/sentinel.css` (hero/KPI/trust styles) · 15. `admin-console/index.html` (3 views + email queue)

**Server** — 16. `netlify/functions/aria-sentinel-quarterly-email.js` (NEW, Resend, admin-gated)

**Tests** — 22 new + count updates to `ia-tabs` / `run18-enterprise-wiring` / `ui-shell` / `run-21-no-regression` + `run-all.mjs`. **Docs** — `ENTERPRISE_READINESS.md` (holds 10.0 + RUN 22 note) · `RUN_22_REPORT.md`.

## 2 · Dashboard tab (markup snippet)

```
🟢 PROTECTED
ARIA is watching · 42 events scanned · 3 threats blocked · last sync 5m ago
┌ Uptime 7d ┐ ┌ MTTR ┐ ┌ Accuracy ┐ ┌ Breaches ┐ ┌ Hours saved ┐ ┌ Version ┐
│  99.9% ▲  │ │ 4 ▼  │ │  92% ▲   │ │   1 →    │ │   33 ▲      │ │ 0.1.0   │   (each: value + sparkline + delta)
Pending: Update v0.1.1 available → Install
Recent: 11:42 🔧 RUN: Cleared %TEMP% ✓   ·   11:30 🩺 DIAGNOSE: slow browser ✓
[Diagnose issue] [Run health check] [Check for updates] [Export evidence pack]
🔒 Local processing · audit integrity verified · 0 outbound to non-allowlisted hosts last 24h · privacy verifier active · 100% sanitization
```
Hero status = `computeHeroStatus({auditOk, privacyOk, tier0Ok, heartbeatOk})` — a security failure (audit/privacy) is CRITICAL; an operational one (Tier-0/heartbeat) is ATTENTION.

## 3 · Performance tab (sample)

| Operational | | AI (the moat) | |
|---|---|---|---|
| MTTD | 0.13 min | Diagnosis accuracy | 92% |
| MTTR | 4 min | Confidence calibration | 95/100 |
| First-touch resolution | 88% | KB hit rate | 71% |
| Auto-resolved | 88% | **Hours saved (MTD)** | **33** |
| Recipe success | 96% | Cost saved (MTD) | $2,100 |

ROI: hours saved = Σ max(0, 47min − resolveTime) over resolved incidents (never negative).

## 4 · SLA tab — 5 categories + tier defaults

| Tier | Uptime | P1 response | Service credits | CSM |
|---|---|---|---|---|
| Personal | 99.0% | <120s | none | — |
| Pro | 99.5% | <60s | none | — |
| Small Business | 99.9% | <30s | 5%/P1 · 1%/P2 · 0.1%/P3 | — |
| Mid Size | 99.95% | <30s | 10%/P1 · 2% · 0.2% | — |
| Enterprise | 99.99% | <15s | 15%/P1 · 3% · 0.3% | ✓ |

Categories: Uptime (24h/7d/30d/90d) · Response SLA by severity · Resolution SLA by severity · Breach tracking (5 reasons) · Compliance window ("97.3% SLA-met this month"). Credits are **calculated, never auto-issued** (admin sign-off required).

## 5 · Compliance tab — composites + R11 counter

SOC 2 100 (strong) · HIPAA 100 (strong) · PIPEDA 100 (strong) · GDPR 100 (strong) — each a 0-100 score from real control states with drill-down. **R11 enforcement counter: 0 attempted accesses — folder never touched.** Plus audit-integrity, privacy verifier, Tier-0 gate, and the RUN 18 evidence-pack export.

## 6 · Reports tab + template preview

Table of generated reports (View · Download · Re-email · Delete) · "Generate ad-hoc report now" · email contact + opt-in config · plain-text preview of what the customer receives.

## 7 · Data retention (enforced)

| Class | Permanent delete | | Class | Permanent delete |
|---|---|---|---|---|
| Audit log | 7y (2555d) | | KB hit logs | 90d |
| Heartbeats | 90d | | Update history | never |
| Diagnostic events | 1y | | Snapshots | 30d (keep latest 5) |
| Recipe logs | 90d | | Quarterly reports | never |
| CSAT / NPS | never | | License usage | never |

Daily 02:00 cleanup honors the table; never deletes legal-hold; never traverses R11 paths.

## 8 · Sample quarterly report (sanitized structure)

```
ARIA Sentinel — 2026-Q3 performance report · your organization
§ Executive summary (3 lines, no LLM)
§ Quarter-over-quarter KPIs (Δ arrows)   § SLA achievement   § Top incidents
§ Hours of human work avoided: 33        § Compliance posture (SOC2 100 / …)
§ Recurring issues + fixes   § Next-quarter work   § Trust (audit · privacy · R11)
```
Filename: `aria-sentinel-quarterly-{license}-{YYYY-QN}.pdf` · PDF via Electron printToPDF · stored in `userData/reports/` + Netlify Blobs `quarterly-reports/`. `reportIsClean()` blocks any un-redacted PII.

## 9 · Quarterly email delivery (Resend)

`aria-sentinel-quarterly-email.js` (admin-gated): for each opted-in license → content-blind HTML body (cover + 6 KPIs + CTA) via `api.resend.com/emails` (dry-run without `RESEND_API_KEY`). Opt-in only (`shouldSend`). Delivery tracked in the `quarterly-reports` store. Subject: `ARIA Sentinel — Q3 2026 performance report for {company}`.

## 10 · Admin console — Fleet Performance + Quarterly Reports + Cohort SLA

3 new views (+ email-queue section): aggregate KPIs across heartbeating licenses, version spread, avg health, silent>24h; quarterly delivery status × open rate; % of each tier meeting its SLA floor. All behind the SENTINEL_ADMIN_TOKEN gate. Emails never auto-fire without sign-off.

## 11 · Test results (per file)

All 22 PASS: dashboard-hero-status · dashboard-kpi-tiles · dashboard-recent-activity · dashboard-quick-actions · performance-kpis · performance-ai-accuracy · performance-hours-saved · performance-tab-no-regression · sla-tracker · sla-breach-credits · sla-tier-thresholds · compliance-frameworks · compliance-r11-enforcement · compliance-evidence-pack · report-generator-quarterly · report-generator-adhoc · report-pdf-no-pii · email-quarterly-delivery · data-retention-policy · data-retention-cleanup-cron · admin-console-fleet-perf · private-folder-never-touched-r22.

Full suite: `node tests/run-all.mjs` → **136 suites, exit 0.**

## 12 · 🔒 R11 enforcement proof

`grep "Private pics and Vids"` across all new RUN 22 source (non-test) returns **3 hits, all enforcement/
confirmation — never a filesystem access:**
- `src/shared/path-guard.mjs` — the exclusion rule (defined RUN 21, reused).
- `src/shared/compliance-score.mjs` + `src/renderer/tabs/compliance.mjs` — the "never touched" confirmation **label** on the Compliance tab.
- `src/main/data-retention.mjs` — a comment documenting the traversal exclusion.

Every text-rendering builder (5 tab modules + report-generator + quarterly-email + data-retention) routes
displayed strings through `redactPrivate`/`sanitizeText`/`isBlockedPath`; `private-folder-never-touched-r22`
feeds the folder path into all of them and asserts it never surfaces. The Compliance tab's R11 counter
reads **0 attempted accesses**.

## 13 · Readiness

`ENTERPRISE_READINESS.md` **holds at 10.0** — RUN 22 is presentation polish on the already-shippable
RUN 21 base, not a new capability gate. External validations (independent pen test + first paid pilot)
remain the only post-ship confirmations.

## 14 · Guardrails honored

- 136/136 green; RUN 17–21 + admin-publish intact; axis stubs untouched.
- 0 new deps (PDF via Electron printToPDF; sparklines via inline SVG; email via existing Resend).
- All reports / HTML / email bodies pass the content-blind sanitizer (no usernames/machines/paths).
- Quarterly email is opt-in; service credits are calculated but never auto-issued (admin sign-off).
- 🔒 R11 enforced across every tab data fetch, report generator, and email template.
- Local commit only — Cowork pushes from the sandbox.

## On-device follow-up

`printToPDF` (offscreen BrowserWindow), the daily 02:00 retention cron, and the quarterly auto-generate
run on the live app only — verified here via the pure builders + source wiring (no Electron in CI). The
pre-update snapshot is a marker file (deep tar deferred; version-history rollback remains the fallback).
Confirm the Netlify Blobs stores (`quarterly-reports`, `heartbeats`, `update-events`) on first deploy.
