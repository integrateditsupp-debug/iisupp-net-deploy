# ARIA Sentinel — Feature Walkthrough (0.1.11)

A surface-by-surface pass over every tab and its primary controls. This is a **static/structural**
walkthrough (the no-Electron CI environment): for each control we verify the button exists in
`src/renderer/index.html`, its click is wired in `src/renderer/renderer.js` (`bindClick`/listener),
and the handler reaches a real `window.sentinel.*` IPC method (or a real in-renderer action). The
**physical click-through on the packaged app is Ahmad's** — see "Manual click-through checklist" at the end.

- **Status legend:** ✅ wired + verified · 🔁 routes to another tab/section · 🛡️ safety-gated.
- Suite at time of writing: **full `npm test` green** (all suites, incl. RUN 34-1…34-5 additions).
- IA: 10 canonical nav tabs (`TAB_TITLES`) + legacy deep-link redirects (`TAB_REDIRECTS`) — every old route
  still resolves to its new parent tab + in-page anchor.

---

## 1. Dashboard (`dashboard`) — default landing
Hosts Overview + Performance + SLA sections (RUN 23d merge).

| Control | id | Wired → | Status |
|---|---|---|---|
| Health check | `dashHealthCheck` | `sentinel.selfDiagnose` | ✅ |
| Diagnose issue | `dashDiagnose` | → ARIA tab Chat (`activateTab("aria")` + focus input) | 🔁 RUN 34-2 |
| Check for updates | `dashCheckUpdates` | `sentinel.checkForUpdate` | ✅ |
| Export evidence | `dashExportEvidence` | `sentinel.exportEvidence` | ✅ |
| KPI tiles / hero status / SLA | `heroStatus`,`healthDot`,… | `loadDashboard/loadPerformance/loadSla` | ✅ render-only |

## 2. ARIA (`aria`) — parent tab, 5 sub-sections (RUN 33 PIVOT)
Sub-section anchors (`aria-chat`/`aria-learning`/`aria-health`/`aria-memory`/`aria-agents`) all switch to
this tab and smooth-scroll to the matching `## H2` (`TAB_REDIRECTS`).

| Control | id | Wired → | Status |
|---|---|---|---|
| Chat input / send | `ariaChatInput`,`ariaChatSend`,`ariaChatForm` | `sentinel.chat` (KB-first → Anthropic → local) | ✅ |
| Chat answer render | `.aria-chat-md` | `renderMarkdown()` — H3/ol/ul/code/links, XSS-safe | ✅ RUN 34-1 |
| Enter / Shift+Enter | (keydown) | Enter submits, Shift+Enter newline | ✅ |
| Article card / source badge | `.aria-chat-article`,`.aria-chat-src` | KB match + "via Anthropic" / "$0" provenance | ✅ |
| Chunks counter | `ariaChatChunks` | KB meta total_chunks | ✅ |
| Learning / Health / Memory / Agents | `learning*`,`memoryList`,`agentFleet`,… | `/aria-kb-stats`, `/aria-system-status` parsers | ✅ render-only |
| Personal-tier upsell nudge | (via `appendChat`) | now posts into `#ariaChatLog` | ✅ **RUN 34-7 fix** |

## 3. Control Center (`control-center`)
| Control | id | Wired → | Status |
|---|---|---|---|
| Start ARIA | `startAria` | `sentinel.startAria` (clears pause, shows globe, monitors) | ✅ |
| Stop ARIA | `stopAria` | `sentinel.stopAria` (watchers off, globe hidden) | ✅ |
| Show globe | `showGlobe` | `sentinel.showGlobe` | ✅ |
| Pause 1 hour | `pauseOneHour` | `sentinel.setPaused(1h)` | ✅ |
| Self check | `runSelfDiagnose` | `sentinel.selfDiagnose` | ✅ |
| Repair ARIA | `runSelfRepair` | `sentinel.selfRepair` | ✅ |
| Diagnose issue | `diagnoseIssue` | → ARIA tab Chat | 🔁 RUN 34-2 |
| Pause updates 7 days | `pauseUpdates` | `sentinel.pauseUpdates` (quarterly-limited) | ✅ 🛡️ |
| Open admin console | `openAdminConsole` | `sentinel.openAdminConsole` | ✅ |
| _(removed)_ Resume watching | — | dead binding deleted; resume = Start ARIA | ✅ **RUN 34-7 fix** |

## 4. Recipes (`recipes`)
| Control | id | Wired → | Status |
|---|---|---|---|
| Run diagnostic | `runDiagnostic` | `sentinel.runDiagnostic` | ✅ 🛡️ dry-run default |
| Recipe rows / diagnostic summary | `diagnosticRows`,`diagnosticSummary` | render-only | ✅ |

## 5. Compliance & Privacy (`compliance-privacy`)
Anchors: `compliance`, `privacy`.

| Control | id | Wired → | Status |
|---|---|---|---|
| Export evidence | `compExportEvidence`,`exportEvidence` | `sentinel.exportEvidence` (content-blind ZIP) | ✅ 🛡️ |
| Live capture (10s) | `liveCapture` | `sentinel.privacyCapture(10000)` | ✅ 🛡️ |
| Export audit (JSON/CSV/PDF) | `exportAudit`,`exportAuditCsv`,`exportAuditPdf` | transparency log download | ✅ |

## 6. Reports (`reports`)
| Control | id | Wired → | Status |
|---|---|---|---|
| Generate report | `generateReport` | `sentinel.generateReport` (quarterly, no-PII) | ✅ |
| Save report prefs | `saveReportPrefs` | `sentinel.saveReportPrefs` | ✅ |

## 7. Knowledge & policy (`knowledge`)
| Control | id | Wired → | Status |
|---|---|---|---|
| Update knowledge | `updateKnowledge` | `sentinel.updateKnowledge` | ✅ |
| Blueprint list / view | `blueprintList`,`blueprintView` | render-only | ✅ |
| Extension instructions | `extInstructions`,`extSteps` | Chrome/Edge/Safari install steps | ✅ |

## 8. System (`system`)
Anchors: `system-context`, `cross-platform`.

| Control | id | Wired → | Status |
|---|---|---|---|
| Refresh system context | `refreshSystemContext` | `sentinel.refreshSystemContext` | ✅ |
| Fallthrough chain | `fallthroughChain` | render-only | ✅ |

## 9. ServiceNow (`servicenow`)
| Control | id | Wired → | Status |
|---|---|---|---|
| Test ServiceNow | `testServiceNow` | `sentinel.testServiceNow` | ✅ |
| Incident list | `incidentList` | render-only | ✅ |

## 10. Settings (`settings`)
Anchors: `mode`, `hotkeys`, `troubleshoot`, `support`, `about`.

| Control | id | Wired → | Status |
|---|---|---|---|
| Auto-update toggle | `autoUpdateToggle` | `sentinel.setAutoUpdate` | ✅ |
| Low-power toggle | `lowPowerToggle` | `sentinel.setLowPower` | ✅ |
| Check for updates / install | `checkUpdates`,`installUpdateBtn`,`checkUpdateChannel` | update flow | ✅ |
| Enter / activate license | `enterLicenseBtn`,`planActivateBtn`,`licenseKeyInput` | `sentinel.enterLicense` (64-char) | ✅ |
| Logout license | `logoutBtn` | `sentinel.logoutLicense` | ✅ |
| Manage plan / subscription | `managePlanBtn`,`manageSubscription`,`upgradePlanBtn` | Stripe portal / checkout | ✅ |
| Test / save notifications | `testNotify`,`saveNotify`,`notifyChannel`,`notifyWebhook` | Slack/webhook | ✅ |
| Delete-confirm prefs | `deleteConfirm`,`deleteCancel`,`resetDeletePrefs`,`deleteOptOut` | triple-confirm delete | ✅ 🛡️ |
| Re-run setup wizard | `reRunSetup` | `sentinel.completeSetup` flow | ✅ |
| Self-diagnose / repair / simulate error | `runSelfDiagnose`,`runSelfRepair`,`simulateAriaError` | self-heal | ✅ |
| Open admin console | `openAdminConsole2` | `sentinel.openAdminConsole` | ✅ |
| Security banner (audit-tamper) | `securityBannerView`,`securityBannerDismiss` | RUN 17 banner (must keep working) | ✅ 🛡️ |

## Global / cross-tab
| Control | id | Wired → | Status |
|---|---|---|---|
| Command palette | `commandPalette`,`cmdkInput` | tab nav by name | ✅ |
| Onboarding (first-run) | `onboardDialog`,`onboardNext`,`onboardSkip` | never replays after dismiss | ✅ |
| Setup wizard (6-step) | `setupNext`,`setupBack` | `completeSetup`; never sets Autonomous silently | ✅ 🛡️ |
| Trial / start trial | `startTrial`,`trialBadge` | trial gate (Pro features) | ✅ |
| Kill-switch (Ctrl+Alt+K) | — | aborts in-flight countdown, kills child procs | ✅ 🛡️ |

---

## Issues surfaced during this walkthrough (→ Slice 34-7, all fixed)
1. **Personal-tier upsell nudge was invisible.** `maybeUpsellOnDetection()` called `appendChat()`, which
   targeted the deleted `#chatStream` dock (removed in 34-2) and silently no-oped. **Fix:** `appendChat`
   now posts into the live ARIA Chat log (`#ariaChatLog`) using the chat's own row markup.
2. **Dead `resumeWatching` binding.** `bindClick("resumeWatching", …)` referenced a button that hasn't
   existed since RUN 15 renamed the run-model to Start/Stop ARIA. It was a guarded no-op. **Fix:** binding
   removed; resume is "Start ARIA" (`applyRunState("start") → pausedUntil: 0`), per `start-stop-aria.test`.

## Manual click-through checklist (Ahmad, on the packaged 0.1.11 build)
These need the real Electron runtime and can't be exercised in CI:
- [ ] ARIA Chat: ask a markdown-heavy question (headings + bullets + code) → renders formatted, not raw `##`.
- [ ] License: paste a 64-char key → activates without the old "Minting…/validating" hang (10s ceiling).
- [ ] Admin console → mint a license: confirm it either completes or shows the actionable env-var error ≤10s.
- [ ] Control Center: Pause 1 hour → Start ARIA → confirm watching resumes immediately (no wait).
- [ ] Personal tier: trigger a detection that would benefit from Confirmed → confirm the upsell appears in chat.
- [ ] Settings: toggle auto-update / low-power; open admin console; security banner view/dismiss.
- [ ] Ctrl+Alt+K during a Confirmed-mode countdown → action aborts, nothing executes.
