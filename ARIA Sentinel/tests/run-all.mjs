import "./scenario-suite.mjs";
import "./extension.test.mjs";
import "./endpoint.test.mjs";
import "./privacy-audit.mjs";
import "./ui-shell.test.mjs";
import "./watchers.test.mjs";
import "./macos-watchers.test.mjs";
import "./overlay-physics.test.mjs";
import "./servicenow.test.mjs";
import "./policy-injection.test.mjs";
import "./content-leak.test.mjs";
import "./idempotency.test.mjs";
import "./kill-switch.test.mjs";
import "./recipe-execution.test.mjs";
import "./recipe-runner.test.mjs";
import "./diagnostic.test.mjs";
import "./health-score.test.mjs";
import "./tray-state.test.mjs";
import "./network-capture.test.mjs";
import "./evidence-pack.test.mjs";
import "./status-badge.test.mjs";
import "./telemetry-event.test.mjs";
import "./autonomous-guards.test.mjs";
import "./autonomous-refire.test.mjs";
import "./slack-notify.test.mjs";
import "./weekly-digest.test.mjs";
import "./audit-export.test.mjs";
import "./low-power.test.mjs";
import "./command-palette.test.mjs";
import "./roi-calc.test.mjs";
import "./license.test.mjs";
import "./auto-update.test.mjs";
import "./api-v1.test.mjs";
import "./patch-management.test.mjs";
import "./multi-tenant.test.mjs";
import "./pwa-manifest.test.mjs";
import "./globe-roam.test.mjs";
import "./admin-console-open.test.mjs";
import "./show-floating-globe.test.mjs";
import "./trial-gate.test.mjs";
import "./network-detect.test.mjs";
import "./mode-behavior.test.mjs";
import "./ia-tabs.test.mjs";
import "./quick-controls.test.mjs";
import "./chrome-ext-install.test.mjs";
import "./hotkeys.test.mjs";
import "./update-manifest.test.mjs";
import "./admin-publish.test.mjs";
import "./license-search.test.mjs";
import "./license-register.test.mjs";
import "./update-rollback.test.mjs";
import "./update-feedurl.test.mjs";
import "./self-heal.test.mjs";
import "./globe-anchor.test.mjs";
import "./globe-greetings.test.mjs";
import "./aria-brain-client.test.mjs";
import "./admin-build-gate.test.mjs";
import "./start-stop-aria.test.mjs";
import "./hotkeys-bind.test.mjs";
import "./live-globe-icons.test.mjs";
// RUN 16 — full-spectrum test battery (12 dimensions).
import "./debug-battery.test.mjs";
import "./qa-battery.test.mjs";
import "./user-journey.test.mjs";
import "./security-battery.test.mjs";
import "./privacy-battery.test.mjs";
import "./scenario-battery.test.mjs";
import "./test-kb-qa.test.mjs";
import "./audit-battery.test.mjs";
import "./soc2-map.test.mjs";
import "./regulatory-map.test.mjs";
import "./legal-inventory.test.mjs";
import "./accessibility-battery.test.mjs";
import "./build-exclusion.test.mjs";
import "./audit-integrity.test.mjs";
import "./icon-pipeline.test.mjs";
// RUN 17 — audit-tamper security banner.
import "./security-banner.test.mjs";
import "./security-banner-dismiss.test.mjs";
// RUN 18 — enterprise verification (wiring lock + artifact-level content-blindness).
import "./run18-enterprise-wiring.test.mjs";
import "./run18-evidence-content-blind.test.mjs";
// RUN 19 — live-app polish + premium UX.
import "./popup-clamp.test.mjs";
import "./sidebar-layout.test.mjs";
import "./kill-switch-hotkey.test.mjs";
import "./delete-triple-confirm.test.mjs";
import "./trial-end-modal.test.mjs";
import "./odd-grid.test.mjs";
import "./live-buttons.test.mjs";
// RUN 20 — system knowledge engine + cross-platform blueprint + safe-generic Tier-0 recipes.
import "./system-context-enum.test.mjs";
import "./system-context-refresh.test.mjs";
import "./symptom-kb-parse.test.mjs";
import "./blueprint-coverage.test.mjs";
import "./tier-0-recipes-dryrun.test.mjs";
import "./diagnostic-reasoner-fuzzy.test.mjs";
import "./diagnostic-reasoner-system-aware.test.mjs";
import "./no-harm-gate.test.mjs";
import "./anomaly-surfacing.test.mjs";
import "./cross-platform-no-control.test.mjs";
import "./event-log-sanitize.test.mjs";
import "./registry-read-only.test.mjs";
import "./escalation-path.test.mjs";
// RUN 21 — auto-update orchestrator + startup hook + admin capture + heartbeat.
import "./update-listener.test.mjs";
import "./update-orchestrator-states.test.mjs";
import "./update-orchestrator-time-windows.test.mjs";
import "./update-orchestrator-fullscreen-defer.test.mjs";
import "./update-rollback-killswitch.test.mjs";
import "./startup-registrar.test.mjs";
import "./startup-tamper-detection.test.mjs";
import "./startup-disable-double-confirm.test.mjs";
import "./heartbeat-payload-content-blind.test.mjs";
import "./heartbeat-endpoint.test.mjs";
import "./admin-publish-captures-event.test.mjs";
import "./admin-mandatory-checkbox.test.mjs";
import "./pause-updates-quarterly-limit.test.mjs";
import "./private-folder-never-touched.test.mjs";
import "./run-21-no-regression.test.mjs";
// RUN 22 — dashboard + performance + SLA + compliance + quarterly reports + retention.
import "./dashboard-hero-status.test.mjs";
import "./dashboard-kpi-tiles.test.mjs";
import "./dashboard-recent-activity.test.mjs";
import "./dashboard-quick-actions.test.mjs";
import "./performance-kpis.test.mjs";
import "./performance-ai-accuracy.test.mjs";
import "./performance-hours-saved.test.mjs";
import "./performance-tab-no-regression.test.mjs";
import "./sla-tracker.test.mjs";
import "./sla-breach-credits.test.mjs";
import "./sla-tier-thresholds.test.mjs";
import "./compliance-frameworks.test.mjs";
import "./compliance-r11-enforcement.test.mjs";
import "./compliance-evidence-pack.test.mjs";
import "./report-generator-quarterly.test.mjs";
import "./report-generator-adhoc.test.mjs";
import "./report-pdf-no-pii.test.mjs";
import "./email-quarterly-delivery.test.mjs";
import "./data-retention-policy.test.mjs";
import "./data-retention-cleanup-cron.test.mjs";
import "./admin-console-fleet-perf.test.mjs";
import "./private-folder-never-touched-r22.test.mjs";
// RUN 23 — self-service loop (process detectors · recommend-action · globe panel · countdown gate ·
// supervisor critic · dry-run policy · quarterly cron · cowork bridge).
import "./process-detectors.test.mjs";
import "./recommend-action.test.mjs";
import "./globe-status-panel.test.mjs";
import "./action-countdown.test.mjs";
import "./supervisor-agent.test.mjs";
import "./dry-run-policy.test.mjs";
import "./quarterly-cron.test.mjs";
import "./cowork-bridge.test.mjs";
import "./run-23-r11-never-touched.test.mjs";
import "./run-23-no-regression.test.mjs";
// RUN 23b — Tier-0 executor binding (5 vetted recipes go live, gated by the supervisor + countdown).
import "./tier-0-executor.test.mjs";
import "./tier-0-rollback.test.mjs";
import "./tier-0-supervisor-integration.test.mjs";
import "./tier-0-r11-never-touched.test.mjs";
// RUN 23c — auto-OTA pipeline (version bump · GitHub Releases publisher · manifest · 1-click admin button).
import "./version-bump.test.mjs";
import "./publish-github-release.test.mjs";
import "./publish-manifest.test.mjs";
import "./admin-console-publish-button.test.mjs";
import "./ota-build-step7.test.mjs";
import "./r11-publish-paths.test.mjs";
// RUN 23d — tab IA 17→9 consolidation (Dashboard/Compliance&Privacy/System/Settings merges + redirects).
import "./tab-ia-consolidation.test.mjs";
// RUN 23e — single build + license-tier feature gating + plan picker + upsell + shouldBump hotfix.
import "./pricing-tiers.test.mjs";
import "./license-features.test.mjs";
import "./upsell.test.mjs";
import "./feature-gating.test.mjs";
import "./plan-picker.test.mjs";
import "./plans-matrix.test.mjs";
// RUN 24 — auto-license funnel (webhook mint/persist/email logic) + admin licenses registry.
import "./sentinel-license-funnel.test.mjs";
import "./sentinel-licenses-api.test.mjs";
import "./admin-licenses-tab.test.mjs";
// RUN 24 A6 — server-side license resolve (secret stays server-side) + desktop offline cache tiers.
import "./sentinel-resolve.test.mjs";
import "./desktop-license-cache.test.mjs";
// RUN 29-A — mode-based dry-run defaults (Manual ON · Confirmed/Autonomous OFF).
import "./dryrun-defaults.test.mjs";
// RUN 29-D — $0 content-blind crash reporter.
import "./crash-reporter.test.mjs";
// RUN 29-C — first-run onboarding state machine (never replays after dismiss).
import "./onboarding-flow.test.mjs";
// RUN 30-B — offline local KB matcher (cross-platform, platform bias).
import "./aria-local-kb.test.mjs";
// RUN 31 — KB-first wiring (aria-kb-query before aria-chat; $0 retrieval).
import "./kb-first-wiring.test.mjs";
// RUN 32-B — 3-mode proof-of-life (Manual/Confirmed/Autonomous execution pipeline).
import "./mode-execution.test.mjs";
// RUN 34-4 — 3-mode × 13-error matrix (every Windows error class × Manual/Confirmed/Autonomous disposition).
import "./mode-error-matrix.test.mjs";
// RUN 34-5 — 20+ Windows-error detector sweep (every live watcher mapper, each content-blind under PII input).
import "./windows-error-sweep.test.mjs";
// RUN 33 PIVOT — ARIA Chat in-tab (Chat sub-section of the ARIA parent tab; detached window removed).
import "./aria-chat-window-ui.test.mjs";
// RUN 35-1 — chat scroll containment (inner log scrolls; outer tab never grows).
import "./chat-scroll-containment.test.mjs";
// RUN 35-2 — aria-kb-query routing iter 7 (security families/takeover · wifi no-word · printer tightened).
import "./aria-kb-routing-iter7.test.mjs";
// RUN 33 Phase 2 — ARIA tab data parsers (status / kb-stats / sessions R11 / heartbeats).
import "./aria-surfaces.test.mjs";
// RUN 33-E — first-launch Setup wizard (state machine + wiring).
import "./setup-wizard.test.mjs";
// RUN 34-1 — readable chat: markdown → HTML rendering.
import "./aria-markdown.test.mjs";
// RUN 34-3 — license mint never hangs (timeouts on every leg + actionable error).
import "./license-mint-timeout.test.mjs";
// RUN 33-A — KB freshness surfaced in the top bar.
import "./kb-freshness.test.mjs";
// W5 — Integrations tab (8 cards · edition-gated · read-only status · ServiceNow→card).
import "./integrations.test.mjs";
// W5 Slice 3 — System Inventory grouped (Apps / Drivers / Security updates · collapsible · filtered).
import "./system-inventory-grouping.test.mjs";
// G-METRICS — proof-metrics store: content-blind counters + deflection/kb-hit/avg math + honest zero.
import "./proof-metrics.test.mjs";
// G-OMNI — Slack/Teams front-end: honest status · sig verify · parse · answer/escalate · content-blind metric.
import "./omni-channel.test.mjs";
// G-PRECISION — precision-first KB matcher: stemmer · synonyms · explicit-platform · routing · out-of-scope reject.
import "./kb-matcher-precision.test.mjs";
// TASK 3/4 — "Resolve it for me" wiring (recipe card + chat chip → supervisedFix confirmed; merged from the resolve branch).
import "./resolve-for-me.test.mjs";

// G-METRICS — FAIL LOUD: no test file may be silently skipped (no fake "green"). Every tests/*.test.mjs
// must be imported above. An un-imported NEW test throws here. Exactly one pre-existing test is quarantined
// WITH a documented reason and announced loudly on every run — it is never hidden.
import { readdirSync, readFileSync as _readFile } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname as _dir, join as _join } from "node:path";
const _here = _dir(fileURLToPath(import.meta.url));
const QUARANTINE = {
  // No quarantines — the "Resolve it for me" renderer wiring was merged in, so resolve-for-me.test.mjs now runs.
};
const _onDisk = readdirSync(_here).filter((f) => f.endsWith(".test.mjs"));
const _self = _readFile(_join(_here, "run-all.mjs"), "utf8");
const _unimported = _onDisk.filter((f) => !_self.includes(`"./${f}"`));
for (const f of _unimported) {
  if (f in QUARANTINE) console.warn(`⚠️  QUARANTINED (not run): ${f} — ${QUARANTINE[f]}`);
}
const _undocumented = _unimported.filter((f) => !(f in QUARANTINE));
if (_undocumented.length) {
  throw new Error(`FAIL LOUD — ${_undocumented.length} test file(s) exist but are NOT imported by run-all.mjs (no fake green): ${_undocumented.join(", ")}`);
}
console.log(`Coverage check: ${_onDisk.length - _unimported.length}/${_onDisk.length} test files imported (${_unimported.length} quarantined + announced).`);
console.log("ARIA Sentinel test suite passed.");
