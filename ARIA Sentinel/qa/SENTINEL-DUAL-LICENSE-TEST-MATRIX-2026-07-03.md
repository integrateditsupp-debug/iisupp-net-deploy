# ARIA Sentinel — Dual-License Test Matrix — 2026-07-03

**Machine-generated** from the app's own pure modules (`license-features.mjs` · `license-plan.mjs` · `pricing-tiers.mjs` · `tab-gating.mjs`) by `scripts/emit-dual-license-matrix.mjs`, and **machine-checked** by `tests/dual-license-matrix.test.mjs` (in `npm test`). This table cannot drift from the shipping gate logic — regenerate to refresh.

Rule 14 (honest / real-or-empty), Rule 15 (every tab preserved — gating never deletes a tab, it locks a paid one behind a dismissible upsell while the baseline stays navigable), Rule 16 (verify every "done"). Legend: ✓ = available/enabled, — = locked/not included.

## How to reproduce
```
cd "ARIA Sentinel"
node tests/run-all.mjs          # full suite incl. dual-license-matrix + gating tests
npm run audit                   # privacy audit
node tests/boot-smoke.mjs       # real Electron boot (nav + quick action + overlay one-box)
node scripts/emit-dual-license-matrix.mjs   # regenerate THIS doc
```

## Feature × license state
| Capability / surface | Admin (internal) | Pro | Small Business | Personal | Trial — active | Trial — expired (free floor) | Trial — expired + Walk-Through |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active plan (resolved) | `admin` | `pro` | `smb` | `personal` | `pro` | `free` | `free` |
| Paid surface unlocked | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Admin console | ✓ | — | — | — | — | — | — |
| Walk-Through entitled | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| Execution modes | manual+confirmed+autonomous | manual+confirmed+autonomous | manual+confirmed+autonomous | manual | manual+confirmed+autonomous | — | — |
| Fix recipes | 77 | 77 | 77 | 14 | 77 | 0 | 0 |
| Local system inventory | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| SLA tracking | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Quarterly PDF reports | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Compliance evidence pack | ✓ | — | ✓ | — | — | — | — |
| Fleet view | ✓ | — | ✓ | — | — | — | — |
| Custom recipes | ✓ | — | ✓ | — | — | — | — |
| White-label | ✓ | — | ✓ | — | — | — | — |

## Navigable/locked tab map × license state
| Capability / surface | Admin (internal) | Pro | Small Business | Personal | Trial — active | Trial — expired (free floor) | Trial — expired + Walk-Through |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tab: dashboard (baseline) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tab: aria (baseline) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tab: settings (baseline) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tab: walkthrough | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| Tab: control-center (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Tab: recipes (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Tab: compliance-privacy (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Tab: reports (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Tab: knowledge (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Tab: system (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Tab: integrations (paid) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |

## What this proves (per the CC directive item 3)
- **Every state resolves to the right plan.** Admin→admin, Pro/Trial-active→pro, Personal→personal, SMB→smb, expired trial→`free` floor.
- **Gating is correct.** Paid tabs unlock on any paid plan or an active trial; they lock on the expired free floor. The admin console is admin-ONLY (fail-closed for every client tier).
- **Baseline always navigable — no dead-shell.** Dashboard · ARIA · Settings stay open in EVERY state, including the expired free floor, so the app is never a locked shell and the buy path (Settings) is always reachable.
- **Walk-Through entitlement is independent of the plan.** It is ON for an active trial, any paid plan whose tier includes it (Pro/SMB/Mid/Enterprise/Admin), and a Concierge buyer (`walkthroughEntitled` flag) even after the trial expires — and OFF for paid Personal (which doesn't include it) and the un-entitled expired floor.
- **Free floor ⊊ Personal.** The expired/unlicensed floor has no modes and no recipes, so buying Personal is a real upgrade.
- **Honest real-or-empty everywhere + premium UX.** The dashboard hero is the colored WORD (no redundant dot), SLA/KPI charts render real-or-empty with a clean axis, and every metric is real or shows "—" (covered by `dashboard-hero-status`, `density-charts-collapse`, and the honesty/fabrication suites).

## Coverage note (development-stage surfaces)
- **Shipped + gated:** all rows above (driven by live gate logic).
- **Dormant/partial:** autonomous overnight/reboot-resume, earned-autonomy ladder — flag-gated OFF; shown as roadmap on /plans, never implied shipped.
- **Planned-but-visible:** MSP portal/white-label depth, KB→1,000+ taxonomy, Edge/Safari + connector marketplace, macOS — listed under "Coming soon" (Rule 14 honest labeling).

_Regenerate after any change to the tier table or gate logic; the matrix test will fail first if the two disagree._
