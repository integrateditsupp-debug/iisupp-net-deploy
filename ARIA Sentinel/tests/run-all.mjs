// ARIA Sentinel test runner — RESILIENT (Task 1b, 2026-06-24).
// Every suite runs in its own try/catch; one missing file or throw can no longer hide the rest. A final
// PASS/FAIL summary lists the reds. Pass --bail to opt back into fail-fast (stop on the first red).
const TESTS = [
  // SECURITY LOCKDOWN 2026-07-01 — repo-level deploy-safety denylist (lives at repo root; runs first).
  "../../tests/deploy-safety-denylist.test.mjs",
  // SERVING-LAYER LOCKDOWN 2026-07-02 — live-probe logic (git-state tests can't see the serving layer).
  "../../tests/probe-deploy-safety.test.mjs",
  // SENTINEL TRIAL GATING 2026-07-02 — 30-day trial + permanent Walk-Through entitlement (Concierge buyers).
  "./walkthrough-entitlement.test.mjs",
  "./tab-gating-post-trial.test.mjs",
  "./walkthrough-webhook-grant.test.mjs",
  "./gating-free-floor.test.mjs", // FIX 2 — free floor ⊊ paid Personal (a paid entry plan is a real upgrade)
  "./dual-license-matrix.test.mjs", // 2026-07-03 — per-state matrix (admin/pro/smb/personal/trial/expired), backbone of the test-matrix doc
  // P1 DEAD-SHELL FIX 2026-07-02 — the free/expired floor must stay a NAVIGABLE tier (never a locked shell).
  "./nav-baseline-navigable.test.mjs",
  "./renderer-no-deadshell.test.mjs",
  // P0 DEAD-SHELL FIX 2026-07-02 — renderer import graph must be browser-safe (no node:/bare specifier can
  // enter it, or the CSP blocks the load and every click dies). Catches the tab-gating→node:crypto regression.
  "./renderer-import-graph.test.mjs",
  // P1 OVERLAY 2026-07-02 — ONE box (no #companionPanel layer) + on-device tap-to-speak voice loop.
  "./overlay-onebox-voice.test.mjs",
  // FORUMS MVP 2026-07-02 — real-KB retrieval + honest abstain + store core + a11y/fabrication gates.
  "../../tests/forums-mvp.test.mjs",
  // FORUMS KNOWLEDGE COMMONS 2026-07-16 — Ahmad chose "1 AND 2": both surfaces ship. Commons a11y +
  // Rule-14 honesty (staged boards, no fabricated counts) + two-way cross-link (neither is a dead end).
  "../../tests/forums-commons.test.mjs",
  // CONCIERGE 2026-07-02 — AI Setup Walk-Through homepage card + aria.html copy + services.html listing.
  "../../tests/concierge-service.test.mjs",
  "./scenario-suite.mjs",
  "./extension.test.mjs",
  "./endpoint.test.mjs",
  "./privacy-audit.mjs",
  "./ui-shell.test.mjs",
  "./watchers.test.mjs",
  // GLOBE FALSE-POSITIVE GATE 2026-07-16 — SYSTEM.SERVICE.STOPPED must not nag about idle-normal Manual/Trigger
  // services (esp. wuauserv); Automatic-down still fires + failure evidence overrides (Rule 15 — detector kept).
  "./service-idle-normal.test.mjs",
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
  "./c2-pilot-state.test.mjs",   // RUN-C C2 — free-pilot mechanic
  "./a1-empty-state-no-fabrication.test.mjs",   // RUN-A A1 — Rule 14 real-or-empty (no fabricated metrics)
  "./admin-console-honesty.test.mjs",   // H1 (2026-07-02) — Rule 14 real-or-empty for the admin console (no fabricated fleet)
  "./symptom-executor.test.mjs",        // F1 (2026-07-02) — matched symptom → vetted Tier-0 executor binding (resolve actually runs)
  "./integrations-tab-restore.test.mjs",// Integrations tab RESTORE (2026-07-02, Rule 15) — full tab set + every connector section
  "./density-charts-collapse.test.mjs", // Density (2026-07-02) — SLA/KPIs as live charts + heavy sections collapse by default
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
  // D6 (2026-07-03) — real disk % used (system-volume free/size), honest fallback when unavailable.
  "./disk-usage.test.mjs",
  "./symptom-kb-parse.test.mjs",
  "./blueprint-coverage.test.mjs",
  "./tier-0-recipes-dryrun.test.mjs",
  "./diagnostic-reasoner-fuzzy.test.mjs",
  "./diagnostic-reasoner-system-aware.test.mjs",
  "./no-harm-gate.test.mjs",
  "./anomaly-surfacing.test.mjs",
  "./root-cause-correlation.test.mjs", // F4 (SENTINEL-BRAIN-AUDIT) — cross-subsystem root-cause correlation -> ONE Resolution Plan
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
  // D1 (2026-07-03) — KB relevance floor: abstain (never return the nearest WRONG article) when no match.
  "./kb-abstain-floor.test.mjs",
  // P0 (2026-07-14) — end-user chat answer shaping: never render Internal Technician Notes / registry / keywords.
  "./chat-answer-shaping.test.mjs",
  // P3 (2026-07-14) — shared TOPICS brain v2.1 battery (root; the offline tier-3 engine synced into Sentinel).
  "../../tests/aria-brain-v2.test.mjs",
  // P0–P2 acceptance (2026-07-14) — L1–L3 IT-director scenario pack: containment-first + honesty invariants.
  "./l1-l3-director-scenarios.test.mjs",
  // D2 (2026-07-03) — Ask-ARIA usage recorded to local memory + stats (Memory/Dashboard reflect real asks).
  "./chat-stats.test.mjs",
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
  // F2 2026-07-03 — bundled full KB text repairs a mid-line-truncated live excerpt (printer "Escalation Trigger").
  "./kb-fulltext.test.mjs",
  // F2 recurrence 2026-07-03 — truncation must be detected EVEN behind the client's "→ Full article:" footer.
  "./kb-answer-truncation.test.mjs",
  // RUN 34-3 — license mint never hangs (timeouts on every leg + actionable error).
  "./license-mint-timeout.test.mjs",
  // RUN 33-A — KB freshness surfaced in the top bar.
  "./kb-freshness.test.mjs",
  // TASK 3 (2026-06-24) — "Resolve it for me" enabled + gated (supervised-fix, Confirmed, never autonomous).
  "./resolve-for-me.test.mjs",
  // Q0b (2026-06-24) — aria-sentinel:// deep-link receiver (pure parser/validator).
  "./deep-link.test.mjs",
  // Q0b (2026-06-24) — web "Open with ARIA Sentinel" emitter ↔ desktop receiver URL contract.
  "./web-handoff-contract.test.mjs",
  // RUN-C C1 (2026-06-30) — funnel "zero dead ends" guard: every customer-facing internal link resolves + conversion chain intact.
  "./funnel-link-guard.test.mjs",
  "./site-fineprint-gate.test.mjs", // 2026-08-04 — the site-wide legal disclaimer strip cannot be lost to a merge
  // 2026-08-04 — the line between an environmental red and a real red cannot be blurred by a later cycle.
  "../../tests/verify-clone-prep.test.mjs",
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
  "./e2-proof-autorun.test.mjs",
  "./e3-revenue-board.test.mjs",
  // RUN-F F1 (2026-07-21) — multi-pilot operations console: N concurrent real pilots, honest empty
  // board, real-or-empty fix/activity, maturity gate (real TTFV + 3 real fixes), staged one-clicks only.
  "./f1-pilot-console.test.mjs",
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
  // STAGE 3 (ARE) FEEDS (2026-07-17) — PLAN-LEVEL autonomous-resolution rate computed FROM the hash-chained
  // plan journal (the sellable Stage-3 number; distinct grain from the chat "was this fixed?" deflection).
  // Real-or-empty + UN-INFLATABLE: only goalProbe-proven real-change PLAN.RESOLVED counts; no-op-neutral,
  // dry-run, pre-exec abort, interrupted, and any TAMPERED "resolved" are all excluded. Pure; frozen files untouched.
  "./plan-deflection.test.mjs",
  // STAGE 3 · F1 × FEEDS JOIN (2026-07-21) — the DURABLE autonomous-resolution feed for RUN-B B1 /
  // Stage-4. plan-deflection decides which runs are honest attempts; durability-ledger decides whether
  // the fix actually HELD through the quiet monitoring window. The headline counts only the intersection,
  // so a fix that came back can never be sold as a resolution. The join may only ever move the number
  // DOWN (asserted over all 162 durability-state combinations). Pure; frozen files untouched.
  "./plan-durability-feed.test.mjs",
  // WALK-THROUGH + WEB CTA + P1 (2026-07-02) — guided step-by-step tab (guide mode changes nothing) +
  // web deep-link mode=walkthrough + "Resolve it for me" never dead-ends at Control Center.
  "./walkthrough-tab-render.test.mjs",
  "./deep-link-walkthrough-mode.test.mjs",
  "./resolve-button-routing.test.mjs",
  "./web-walkthrough-cta.test.mjs",
  // WALK-THROUGH UNDER THE GLOBE (2026-07-14) — the tab is a launcher → Start opens the guided flow under the
  // floating globe + live-opens each target; the live-open never auto-enters credentials/pays (Rule 14 boundary).
  "./walkthrough-launcher.test.mjs",
  "./walkthrough-open-live.test.mjs",
  // WALK-THROUGH V2 AUTO-RUN (2026-07-16) — ARIA auto-opens the safe (non-hard-stop) allowlisted targets + auto-
  // advances display cards, and HALTS at every input/choice/copy + sign-in/account/pay hard-stop (Rule 14 boundary).
  "./walkthrough-autorun.test.mjs",
  // P5/P6/P7 (2026-07-14) — not-yet offers next steps + a real ticket ref surfaced in-app; answer concision toggle.
  "./chat-escalation-ticket.test.mjs",
  "./answer-concision-p7.test.mjs",
  // ARIA COMPANION (2026-07-02) — globe → interactive assistant; typed step engine collecting input; honest
  // Claude AI-setup (no invented price, user-click accounts); interactive Learn lessons.
  "./companion-shell.test.mjs",
  "./step-engine-input.test.mjs",
  "./ai-setup-claude-honest.test.mjs",
  "./learn-prompts-loops.test.mjs",
  // COMPANION GLOBE-BOX + VOICE (2026-07-02) — keep the globe (small card below it, not inset:0); on-device
  // tap-to-speak (STT) + calm female narration (TTS), both guarded, muteable, $0.
  "./companion-globe-box.test.mjs",
  "./companion-voice.test.mjs",
  // HELP SURFACES (2026-07-16) — public Technical Support FAQ built from the real KB (end-user-safe,
  // FAQPage JSON-LD) + Forums Concierge (auto-answer, honest abstain, $0) + Moderator (reversible tiers,
  // never hard-deletes) + the web KB-shaper mirror kept in parity with the canonical Sentinel shaper.
  "../../tests/support-faq.test.mjs",
  "../../tests/forums-concierge.test.mjs",
  "../../tests/forums-moderation.test.mjs",
  "../../tests/kb-answer-shape-parity.test.mjs",
  "./f2-conversion-digest.test.mjs",
  "./f3-acquisition-funnel.test.mjs",
  "./g1-demand-intake.test.mjs",
  "./g2-followup-cadence.test.mjs",
  "./g3-delivery-leverage.test.mjs",
  "./h1-proof-pack.test.mjs",
  "./h2-objection-ledger.test.mjs",
  "./h3-close-packet.test.mjs",
  "./i1-billing-handoff.test.mjs",
  "./i2-renewal-readiness.test.mjs",
  "./i3-revenue-truth-board.test.mjs",
  "./j1-deal-blocker-autopsy.test.mjs",
  "./j2-delivery-capacity-truth.test.mjs",
  "./j3-weekly-truth-digest.test.mjs",
  "./k1-payment-receipt-ledger.test.mjs",
  "./k2-time-to-first-dollar.test.mjs",
  "./k3-one-page-ask.test.mjs",
  "./l1-demand-to-ask-conveyor.test.mjs", // RUN-L L1 — demand-to-ask conveyor
  "./l2-repeatability-audit.test.mjs",   // RUN-L L2 — second-customer repeatability
  "./l3-pricing-floor.test.mjs",         // RUN-L L3 — honest pricing floor
  "./m1-ask-ready-queue.test.mjs",       // RUN-M M1 — ask-ready queue, ranked by real evidence
  "./m2-send-packet.test.mjs",           // RUN-M M2 — send packet, one click from sent
  "./m3-ask-ledger.test.mjs",            // RUN-M M3 — ask ledger, paid requires a real receipt
  "./n1-account-intake.test.mjs",        // RUN-N N1 — real-input intake path, M1's gate vocabulary
  "./n2-first-packet-pass.test.mjs",     // RUN-N N2 — end-to-end pass: a packet XOR a named gap list
  "./n3-ask-dashboard.test.mjs",         // RUN-N N3 — operator ask dashboard, zero reads as zero
  // RUN-O 2026-07-28 — the operator's first hour. One current entry point, one guided walk, one
  // generated ledger head. The drift lock in o3 is the teeth: AXIS status, operator brief and ledger
  // head are rendered from ONE normalised truth, and any disagreement between them turns this suite red.
  "./o1-operator-brief.test.mjs",         // RUN-O O1 — one current script, superseded marked in place
  "./o2-first-account-walk.test.mjs",     // RUN-O O2 — nothing to packet XOR named gaps, source-annotated
  "./o3-ledger-head.test.mjs",            // RUN-O O3 — one truth, three surfaces; history untouched

  // RUN-P 2026-07-28 — the first real ask. The last metre: a rendered artefact a human can put in
  // front of a named person, one gated staging moment, and a lock that keeps "staged" from ever
  // being read as "sent" on any surface.
  "./p1-rendered-ask.test.mjs",           // RUN-P P1 — every sentence traces to a record, or it is refused by name
  "./p2-ask-staging.test.mjs",            // RUN-P P2 — human-sendable artefact + staged row; sent is impossible from inside
  "./p3-staged-vs-sent.test.mjs",         // RUN-P P3 — staged and sent are separate numbers on all three surfaces
  "./q1-candidate-record.test.mjs",       // RUN-Q Q1 — a candidate records with named provenance per field; inference is refused by name
  "./q2-candidate-fit.test.mjs",          // RUN-Q Q2 — deterministic fit score that says "not established" instead of averaging around a hole
  "./q3-candidate-bridge.test.mjs",
  // RUN-R — the first hour spent outside the building.
  "./r1-hour-plan.test.mjs",
  "./r2-conversation-outcome.test.mjs",
  "./r3-conversations-held.test.mjs",       // RUN-Q Q3 — lossless bridge into N1 intake; candidates is a fourth distinct number on all three surfaces
  // RUN-S 2026-07-28 — the sequence that exists to move conversations held from 0 to 1.
  "./s1-quick-entry.test.mjs",              // RUN-S S1 — the one-minute entry path; Q1's refusals verbatim; no tracked/serveable write path
  "./s2-honest-opening.test.mjs",           // RUN-S S2 — the shortest honest opening, refusable; every unsupportable claim class refused by name
  "./s3-first-hour-loop.test.mjs",          // RUN-S S3 — R1->S1->S2->R2 in one walk; hours spent as the sixth number beside conversations held
  // RUN-T 2026-07-28 — the sequence that exists to make an hour actually get spent.
  "./t1-name-sources.test.mjs",             // RUN-T T1 — where the first names already are; every excluded source named with its reason
  "./t2-elapsed-since.test.mjs",            // RUN-T T2 — days-since with `never` distinct from zero; software progress cannot move it
  "./t3-staged-hour.test.mjs",              // RUN-T T3 — the hour staged (never scheduled); an unwalked hour is a finding, not a rollover
  // RUN-U 2026-07-28 — the counters read the mail. Built because RUN 110-129 published asksSent: 0
  // through a 41-send week: the counters read an internal log that outbound was never written into.
  "./u1-outbound-truth.test.mjs",           // RUN-U U1/U2 — mail-sourced counters; 0 vs never vs unverified; understatement named as a Rule 14 failure
  "./v1-warm-redirect.test.mjs",            // RUN-V V1/V2/V3 — ranked warm-redirect queue (expiry first-class), refusable second message (no transport), reply-rate as the sixth number
  "./w1-first-answered-reply.test.mjs",     // RUN-W W1/W2/W3 — reply capture (`no reply yet` != 0 != unverified), one-way outcome ladder, surfaces that cannot claim an unevidenced rung
  "./x1-cost-of-delay.test.mjs",            // RUN-X X1/X2/X3 — rising cost of delay (software progress cannot lower it), the hour executable cold, two named blockers byte-identical on every surface
  "./z1-second-hour.test.mjs",              // RUN-Z Z1/Z2/Z3 — waiting interval computed from real dates (can say "nothing today"), silence held without characterising intent or moving any ladder, and a repeat that is one-way across all hours and bounded at REPEAT_MAX with retirement stated
  "./y1-spent-hour.test.mjs",               // RUN-Y Y1/Y2/Y3 — operator-entered spent hour (`not spent` != 0 != unverified), change set empty when nothing moved, executed actions consumed and never re-ranked live
  "./aa1-unopened-week.test.mjs",           // RUN-AA AA1/AA2/AA3 — a gap of any length (7/30/200/400 days) renders no judgement, no streak, no exclamation and moves no rung or cost; one cold-executable re-entry page whose change set is a real difference and renders "Nothing changed while you were away." verbatim; a weekly roll-up that states the unmoved counts FIRST, keeps `nothing recorded` distinct from `recorded, nothing done`, and admits no software progress
  "./ac1-visit-log.test.mjs",              // RUN-AC AC1/AC2 — the first passive signal: the site's own first-party hit log, read by a module that can never turn an absent or not-yet-running log into a zero, refuses any count over a window reaching back before `startedAt`, rejects the whole record if a single identity-shaped key appears, excludes our own tooling from the headline, and flips `site-visits` to measurable ONLY on a genuinely observed record — leaving every other signal refused
  "./ab1-moves-without-us.test.mjs",      // RUN-AB AB1/AB2/AB3 — the whole mail record measured (45 sent, 4 undeliverable, 11 auto-replied, 1 personal reply, the rest silent-by-absence) with `delivered` refused as unobserved at every volume and no rate computed against it; the passive surface refused as the PRIMARY dated output with every unobservable signal named and no proxy promotable; and a two-column split where software progress — however rephrased — can never place an item in "moves on its own", which today is empty
  // STAGE-3 ARE — packets landed by Cowork run 113 (2026-07-21). Registered here because each packet's
  // run-all patch was cut against an older anchor; the suites themselves are unmodified from the packets.
  "./escalation-decision.test.mjs",
  "./plan-boot-recovery.test.mjs",
  "./multi-hypothesis.test.mjs",
  "./unbound-recipe-walkthrough.test.mjs",
  "./plan-maintenance-window.test.mjs",
  "./goal-probe-grade.test.mjs",
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

const loadReds = results.filter((r) => !r.ok);

// 2026-07-28 (Cowork run 126) — THE HARNESS COULD HIDE A RED, AND DID.
//
// `await import(spec)` resolves when a module finishes EVALUATING. A node:test file only REGISTERS
// its tests during evaluation; the assertions run afterwards, on a later turn of the event loop, and
// a failure surfaces by setting `process.exitCode` — it never throws back into this try/catch. So the
// old summary printed "N/N suites green" BEFORE a single assertion had run, and two genuinely failing
// suites were reported as green in the same breath. That is exactly the fabricated-metric class
// Rule 14 forbids, produced by our own test harness.
//
// The summary is therefore deferred to `beforeExit`, which fires only once the event loop has
// drained — i.e. after every registered test has actually run and recorded its verdict. The count is
// folded together with `process.exitCode` so an assertion failure can never again be summarised away.
// Load failures are still reported separately, because "did not load" and "loaded and failed" are
// different facts and collapsing them would hide which one happened.
let summarised = false;
process.on("beforeExit", () => {
  if (summarised) return;
  summarised = true;
  const assertionsFailed = process.exitCode !== undefined && process.exitCode !== 0;
  const total = results.length;
  if (loadReds.length) {
    console.error(`\n${loadReds.length} suite(s) FAILED TO LOAD:`);
    for (const r of loadReds) console.error(`  ✗ ${r.spec} — ${String(r.err).split("\n")[0]}`);
  }
  if (assertionsFailed) {
    console.error(`\nSUITE RED — at least one assertion failed. ${total} suite file(s) were run; the ` +
      `per-test output above names the failures. A green count is deliberately NOT printed here, because ` +
      `a passing-suite number next to a failing assertion is the lie this harness once told.`);
    return;
  }
  if (loadReds.length) { process.exitCode = 1; return; }
  console.log(`\n${total}/${total} suites green.`);
  console.log("ARIA Sentinel test suite passed.");
});
if (bail && loadReds.length) process.exit(1);
