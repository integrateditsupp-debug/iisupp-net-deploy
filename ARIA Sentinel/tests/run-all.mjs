// ARIA Sentinel test runner — RESILIENT (Task 1b, 2026-06-24).
// Every suite runs in its own try/catch; one missing file or throw can no longer hide the rest. A final
// PASS/FAIL summary lists the reds. Pass --bail to opt back into fail-fast (stop on the first red).
const TESTS = [
  // SECURITY LOCKDOWN 2026-07-01 — repo-level deploy-safety denylist (lives at repo root; runs first).
  "../../tests/deploy-safety-denylist.test.mjs",
  "./scenario-suite.mjs",
  "./extension.test.mjs",
  "./endpoint.test.mjs",
  "./privacy-audit.mjs",
  "./ui-shell.test.mjs",
  "./watchers.test.mjs",
  "./macos-watchers.test.mjs",
  "./overlay-physics.test.mjs",
  "./servicenow.test.mjs",
  "./policy-injection.test.mjs",
  "./content-leak.test.mjs",
  "./idempotency.test.mjs",
  "./kill-switch.test.mjs",
  "./recipe-execution.test.mjs",
  "./recipe-runner.test.mjs",
  "./diagnostic.test.mjs",
  "./health-score.test.mjs",
  "./tray-state.test.mjs",
  "./network-capture.test.mjs",
  "./evidence-pack.test.mjs",
  "./status-badge.test.mjs",
  "./telemetry-event.test.mjs",
  "./autonomous-guards.test.mjs",
  "./autonomous-refire.test.mjs",
  "./slack-notify.test.mjs",
  "./weekly-digest.test.mjs",
  "./audit-export.test.mjs",
  "./low-power.test.mjs",
  "./command-palette.test.mjs",
  "./roi-calc.test.mjs",
  "./license.test.mjs",
  "./sentinel-version-sync.test.mjs",
  "./c2-pilot-state.test.mjs",   // RUN-C C2 — free-pilot mechanic
  "./a1-empty-state-no-fabrication.test.mjs",   // RUN-A A1 — Rule 14 real-or-empty (no fabricated metrics)
  "./auto-update.test.mjs",
  "./api-v1.test.mjs",
  "./patch-management.test.mjs",
  "./multi-tenant.test.mjs",
  "./pwa-manifest.test.mjs",
  "./globe-roam.test.mjs",
  "./admin-console-open.test.mjs",
  "./show-floating-globe.test.mjs",
  "./trial-gate.test.mjs",
  "./network-detect.test.mjs",
  "./mode-behavior.test.mjs",
  "./ia-tabs.test.mjs",
  "./quick-controls.test.mjs",
  "./chrome-ext-install.test.mjs",
  "./hotkeys.test.mjs",
  "./update-manifest.test.mjs",
  "./admin-publish.test.mjs",
  "./license-search.test.mjs",
  "./license-register.test.mjs",
  "./update-rollback.test.mjs",
  "./update-feedurl.test.mjs",
  "./self-heal.test.mjs",
  "./globe-anchor.test.mjs",
  "./globe-greetings.test.mjs",
  "./aria-brain-client.test.mjs",
  "./admin-build-gate.test.mjs",
  "./start-stop-aria.test.mjs",
  "./hotkeys-bind.test.mjs",
  "./live-globe-icons.test.mjs",
  // RUN 16 — full-spectrum test battery (12 dimensions).
  "./debug-battery.test.mjs",
  "./qa-battery.test.mjs",
  "./user-journey.test.mjs",
  "./security-battery.test.mjs",
  "./privacy-battery.test.mjs",
  "./scenario-battery.test.mjs",
  "./test-kb-qa.test.mjs",
  "./audit-battery.test.mjs",
  "./soc2-map.test.mjs",
  "./regulatory-map.test.mjs",
  "./legal-inventory.test.mjs",
  "./accessibility-battery.test.mjs",
  "./build-exclusion.test.mjs",
  "./audit-integrity.test.mjs",
  "./icon-pipeline.test.mjs",
  // RUN 17 — audit-tamper security banner.
  "./security-banner.test.mjs",
  "./security-banner-dismiss.test.mjs",
  // RUN 18 — enterprise verification (wiring lock + artifact-level content-blindness).
  "./run18-enterprise-wiring.test.mjs",
  "./run18-evidence-content-blind.test.mjs",
  // RUN 19 — live-app polish + premium UX.
  "./popup-clamp.test.mjs",
  "./sidebar-layout.test.mjs",
  "./kill-switch-hotkey.test.mjs",
  "./delete-triple-confirm.test.mjs",
  "./trial-end-modal.test.mjs",
  "./odd-grid.test.mjs",
  "./live-buttons.test.mjs",
  // RUN 20 — system knowledge engine + cross-platform blueprint + safe-generic Tier-0 recipes.
  "./system-context-enum.test.mjs",
  "./system-context-refresh.test.mjs",
  "./symptom-kb-parse.test.mjs",
  "./blueprint-coverage.test.mjs",
  "./tier-0-recipes-dryrun.test.mjs",
  "./diagnostic-reasoner-fuzzy.test.mjs",
  "./diagnostic-reasoner-system-aware.test.mjs",
  "./no-harm-gate.test.mjs",
  "./anomaly-surfacing.test.mjs",
  "./cross-platform-no-control.test.mjs",
  "./event-log-sanitize.test.mjs",
  "./registry-read-only.test.mjs",
  "./escalation-path.test.mjs",
  // RUN 21 — auto-update orchestrator + startup hook + admin capture + heartbeat.
  "./update-listener.test.mjs",
  "./update-orchestrator-states.test.mjs",
  "./update-orchestrator-time-windows.test.mjs",
  "./update-orchestrator-fullscreen-defer.test.mjs",
  "./update-rollback-killswitch.test.mjs",
  "./startup-registrar.test.mjs",
  "./startup-tamper-detection.test.mjs",
  "./startup-disable-double-confirm.test.mjs",
  "./heartbeat-payload-content-blind.test.mjs",
  "./heartbeat-endpoint.test.mjs",
  "./admin-publish-captures-event.test.mjs",
  "./admin-mandatory-checkbox.test.mjs",
  "./pause-updates-quarterly-limit.test.mjs",
  "./private-folder-never-touched.test.mjs",
  "./run-21-no-regression.test.mjs",
  // RUN 22 — dashboard + performance + SLA + compliance + quarterly reports + retention.
  "./dashboard-hero-status.test.mjs",
  "./dashboard-kpi-tiles.test.mjs",
  "./dashboard-recent-activity.test.mjs",
  "./dashboard-quick-actions.test.mjs",
  "./performance-kpis.test.mjs",
  "./performance-ai-accuracy.test.mjs",
  "./performance-hours-saved.test.mjs",
  "./performance-tab-no-regression.test.mjs",
  "./sla-tracker.test.mjs",
  "./sla-breach-credits.test.mjs",
  "./sla-tier-thresholds.test.mjs",
  "./compliance-frameworks.test.mjs",
  "./compliance-r11-enforcement.test.mjs",
  "./compliance-evidence-pack.test.mjs",
  "./report-generator-quarterly.test.mjs",
  "./report-generator-adhoc.test.mjs",
  "./report-pdf-no-pii.test.mjs",
  "./email-quarterly-delivery.test.mjs",
  "./data-retention-policy.test.mjs",
  "./data-retention-cleanup-cron.test.mjs",
  "./admin-console-fleet-perf.test.mjs",
  "./private-folder-never-touched-r22.test.mjs",
  // RUN 23 — self-service loop (process detectors · recommend-action · globe panel · countdown gate ·
  // supervisor critic · dry-run policy · quarterly cron · cowork bridge).
  "./process-detectors.test.mjs",
  "./recommend-action.test.mjs",
  "./globe-status-panel.test.mjs",
  "./action-countdown.test.mjs",
  "./supervisor-agent.test.mjs",
  "./dry-run-policy.test.mjs",
  "./quarterly-cron.test.mjs",
  "./cowork-bridge.test.mjs",
  "./run-23-r11-never-touched.test.mjs",
  "./run-23-no-regression.test.mjs",
  // RUN 23b — Tier-0 executor binding (5 vetted recipes go live, gated by the supervisor + countdown).
  "./tier-0-executor.test.mjs",
  "./tier-0-rollback.test.mjs",
  "./tier-0-supervisor-integration.test.mjs",
  "./tier-0-r11-never-touched.test.mjs",
  // RUN 23c — auto-OTA pipeline (version bump · GitHub Releases publisher · manifest · 1-click admin button).
  "./version-bump.test.mjs",
  "./publish-github-release.test.mjs",
  "./publish-manifest.test.mjs",
  "./admin-console-publish-button.test.mjs",
  "./ota-build-step7.test.mjs",
  "./r11-publish-paths.test.mjs",
  // RUN 23d — tab IA 17→9 consolidation (Dashboard/Compliance&Privacy/System/Settings merges + redirects).
  "./tab-ia-consolidation.test.mjs",
  // RUN 23e — single build + license-tier feature gating + plan picker + upsell + shouldBump hotfix.
  "./pricing-tiers.test.mjs",
  "./license-features.test.mjs",
  "./upsell.test.mjs",
  "./feature-gating.test.mjs",
  "./plan-picker.test.mjs",
  "./plans-matrix.test.mjs",
  // R-ONE N1 — site-wide pricing guard: 0 stale tier prices anywhere + pages match the single source.
  "./site-pricing-guard.test.mjs",
  // RUN 24 — auto-license funnel (webhook mint/persist/email logic) + admin licenses registry.
  "./sentinel-license-funnel.test.mjs",
  "./sentinel-licenses-api.test.mjs",
  "./admin-licenses-tab.test.mjs",
  // 2026-07-04 - corporate rescue safety foundation (policy-only; no live RDP grant).
  "./rdp-access.test.mjs",
  "./admin-rdp-access-tab.test.mjs",
  // RUN 24 A6 — server-side license resolve (secret stays server-side) + desktop offline cache tiers.
  "./sentinel-resolve.test.mjs",
  "./desktop-license-cache.test.mjs",
  // RUN 29-A — mode-based dry-run defaults (Manual ON · Confirmed/Autonomous OFF).
  "./dryrun-defaults.test.mjs",
  // RUN 29-D — $0 content-blind crash reporter.
  "./crash-reporter.test.mjs",
  // RUN 29-C — first-run onboarding state machine (never replays after dismiss).
  "./onboarding-flow.test.mjs",
  // RUN 30-B — offline local KB matcher (cross-platform, platform bias).
  "./aria-local-kb.test.mjs",
  // RUN 31 — KB-first wiring (aria-kb-query before aria-chat; $0 retrieval).
  "./kb-first-wiring.test.mjs",
  // RUN 32-B — 3-mode proof-of-life (Manual/Confirmed/Autonomous execution pipeline).
  "./mode-execution.test.mjs",
  // RUN 34-4 — 3-mode × 13-error matrix (every Windows error class × Manual/Confirmed/Autonomous disposition).
  "./mode-error-matrix.test.mjs",
  // RUN 34-5 — 20+ Windows-error detector sweep (every live watcher mapper, each content-blind under PII input).
  "./windows-error-sweep.test.mjs",
  // RUN 33 PIVOT — ARIA Chat in-tab (Chat sub-section of the ARIA parent tab; detached window removed).
  "./aria-chat-window-ui.test.mjs",
  // RUN 35-1 — chat scroll containment (inner log scrolls; outer tab never grows).
  "./chat-scroll-containment.test.mjs",
  // RUN 35-2 — aria-kb-query routing iter 7 (security families/takeover · wifi no-word · printer tightened).
  "./aria-kb-routing-iter7.test.mjs",
  // RUN 36 round-3 — routing coverage for calendar · external display · conference-room AV (top50-gaps).
  "./aria-kb-routing-round3.test.mjs",
  // Q-QA1 — web /aria classifier accuracy computed at test time + per-intent 50% floor + AD regression lock.
  "./classifier-accuracy.test.mjs",
  // Q-WEBTIER — $70/mo ARIA Web + AI Edge: env-aware config + card model + checkout wiring + matrix separation.
  "./web-tier-contract.test.mjs",
  // R-ONE N2 — implementation add-on selector → quote request (no Stripe charge).
  "./impl-addon-quote.test.mjs",
  // Q-DIR / Q-DIR+ (R3) — identity-tier directory provider: cannot-mess-up protocol + failure-injection (mock-only).
  "./directory.test.mjs",
  // Q-DIR slice 2 — live Microsoft Graph DirectoryProvider adapter (read-only; mock-fetch tested).
  "./entra-graph-client.test.mjs",
  // RUN 33 Phase 2 — ARIA tab data parsers (status / kb-stats / sessions R11 / heartbeats).
  "./aria-surfaces.test.mjs",
  // RUN 33-E — first-launch Setup wizard (state machine + wiring).
  "./setup-wizard.test.mjs",
  // RUN 34-1 — readable chat: markdown → HTML rendering.
  "./aria-markdown.test.mjs",
  // RUN 34-3 — license mint never hangs (timeouts on every leg + actionable error).
  "./license-mint-timeout.test.mjs",
  // RUN 33-A — KB freshness surfaced in the top bar.
  "./kb-freshness.test.mjs",
  // TASK 3 (2026-06-24) — "Resolve it for me" enabled + gated (supervised-fix, Confirmed, never autonomous).
  "./resolve-for-me.test.mjs",
  // 2026-07-04 - Office File Safety Net and trainer foundations.
  "./office-file-safety.test.mjs",
  "./office-safety-service.test.mjs",
  "./office-trainer.test.mjs",
  // Q0b (2026-06-24) — aria-sentinel:// deep-link receiver (pure parser/validator).
  "./deep-link.test.mjs",
  // Q0b (2026-06-24) — web "Open with ARIA Sentinel" emitter ↔ desktop receiver URL contract.
  "./web-handoff-contract.test.mjs",
  // RUN-C C1 (2026-06-30) — funnel "zero dead ends" guard: every customer-facing internal link resolves + conversion chain intact.
  "./funnel-link-guard.test.mjs",
  // RUN-C C3 (2026-06-30) — 5-minute onboarding activation + time-to-first-value (real-or-empty, no dead step).
  "./onboarding-activation.test.mjs",
  // RUN-D D2 (2026-07-01) — pilot->paid capture engine: case study real-or-empty + consent gate + conversion moment.
  "./d2-case-study.test.mjs",
  // RUN-D D2 wiring (2026-07-01) — case-study/conversion-moment plumbed into main IPC + preload + pilot-expiry pending surface.
  "./d2-wire-conversion.test.mjs",
  // RUN-B B1 (2026-07-01) — "Was this fixed?" feedback loop -> real deflection %% (real-or-empty; feeds dashboard tile + D2 proof).
  "./resolution-outcome.test.mjs",
  "./value-proof.test.mjs",   // RUN-B B2 — real ROI $/hours + real deflection on every surface (real-or-empty)
  // RUN-B B5 (2026-07-01) — under-globe "issue resolved | email sent | ticket ref" confirmation (real-or-empty; desktop overlay + web mirror parity).
  "./b5-globe-confirmation.test.mjs",
  "./b3-trust-posture.test.mjs",   // RUN-B B3 — honest trust/security surface (no over-claim, real-or-empty)
  "./b4-axis-chat.test.mjs",       // RUN-B B4 — AXIS chat: env-driven model + honest offline fallback (no silent Brain-busy)
  // RUN-E E1 (2026-07-02) — pilot activation -> TTFV clock: first real audit-log RUN fix stamps ttfvMinutes into pilot.json (write-once, real-or-empty "--").
  "./e1-pilot-activation-ttfv.test.mjs",
  // RUN-B B6 (2026-07-01) — regression-sweep LOCK: RUN-B modules present, gates stay registered, honesty moat live, real-or-empty + inflated Trust pages stay deleted.
  "./b6-regression-sweep.test.mjs",
  // STAGE 3 S1 (2026-07-01) — Autonomous Resolution Engine, Confirmed mode only: plan schema +
  // hash-chained journal + executor loop (supervisor/countdown/tier-0 reused UNCHANGED) +
  // 3 authored playbooks. R11 check #1 at every new layer; goalProbe declares success, never steps.
  "./plan-schema.test.mjs",
  "./plan-journal-hashchain.test.mjs",
  "./plan-supervisor-midplan-veto.test.mjs",
  "./plan-rollback-reverse-order.test.mjs",
  "./plan-goalprobe-real-or-empty.test.mjs",
  "./plan-resume-after-reboot.test.mjs",
  "./plan-autonomy-ladder.test.mjs",
  "./plan-r11-and-killswitch.test.mjs",
];

const bail = process.argv.includes("--bail");
const results = [];
for (const spec of TESTS) {
  try {
    await import(spec);
    results.push({ spec, ok: true });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    results.push({ spec, ok: false, err: msg });
    if (bail) { console.error(`✗ ${spec}\n${(err && err.stack) || err}`); process.exit(1); }
  }
}

const reds = results.filter((r) => !r.ok);
const greenCount = results.length - reds.length;
console.log(`\n${greenCount}/${results.length} suites green${reds.length ? `, ${reds.length} FAILED` : ""}.`);
for (const r of reds) console.error(`  ✗ ${r.spec} — ${String(r.err).split("\n")[0]}`);
if (reds.length) process.exit(1);
console.log("ARIA Sentinel test suite passed.");
