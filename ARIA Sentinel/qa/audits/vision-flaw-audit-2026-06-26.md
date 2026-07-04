# ARIA Sentinel / AXIS — Vision-vs-Reality Flaw Audit
**Date:** 2026-06-26
**Auditor:** Claude (Cowork) — independent QA pass under Rule 14 (100% honest, no softening)
**Branch audited:** `cc/sentinel-resolve-reconcile-2026-06-26` (HEAD `0ab3e99`)
**Cross-branch reference:** `origin/cc/axis-command-center-2026-06-26` (AXIS work, **unmerged**)

---

## Executive verdict

**Is the vision delivered? Partially — the desktop Sentinel core is real and well-tested; the three newest headline features in the audit brief are NOT delivered on this branch.**

Genuinely built and honest:
- Desktop gated control plane (R11 private-folder guard -> supervisor critic -> execution policy -> 10s countdown -> Ctrl+Alt+K kill switch) is real, wired, and tested.
- Proof-metrics are content-blind and honest (real zeros, no NaN, no fabrication). Measured KB self-test deflection is **68.9%** (31/45) — a real, defensible number.
- The Sentinel Netlify functions all guard `JSON.parse(event.body || "{}")`, so the "500-on-empty-body" crash class is already fixed in the functions that exist.
- Test suite is green: **188/188 test files imported, 0 quarantined.**

NOT delivered (spec-vs-code gap):
1. **First-run Profile + Session-End Email feature (spec dated TODAY, 2026-06-26) is 0% implemented.** No `src/shared/profile.mjs`, no `src/shared/session.mjs`, no `sentinel-session-report` function, no `tests/profile-session.test.mjs`. Zero references anywhere.
2. **AXIS Command Center is unmerged** (only on `cc/axis-command-center-2026-06-26`). Even there the **approve-hop is a dead-end**: the director writes approvals/commands to a `axis-inbox` Blobs store that **no worker ever reads**.
3. **AXIS Voice Director's headline privacy features (speaker-lock, wake gate, encrypted brain, TTS round-trip) are stubs** — `whisper-wrapper.mjs` throws "not implemented (Phase 1 stub)"; **no speaker-ID/voiceprint code exists**.
4. **The web "Resolve it for me" auto-fix is scripted theater** — hardcoded fake "AUDIT TRAIL - LIVE" with invented timestamps, device IDs, and fabricated "downtime saved / ticket cost" metrics. Currently neutralized on the live site by a separate client-side script that grays it to "COMING SOON," but the dishonest code still ships and suppression is fragile.

### Top 5 risks
1. **(P1 / Rule-14)** Web `renderAutoResolution()` ships fabricated audit trails + invented downtime/cost metrics in `aria.html`. Only hidden at runtime by `aria-transform.js` overlay (`pointer-events:none` + "COMING SOON"). If that script fails to load or is removed, users see a fake "fix" with made-up numbers.
2. **(P1)** Profile-gate + session-end-email feature specced for today is entirely missing.
3. **(P1)** AXIS approve-hop is non-functional: commands/approvals go into `axis-inbox` Blobs and are never consumed by `senior-director-worker.mjs`. "Instant approvals" is a write-only black hole.
4. **(P2)** AXIS Voice Director sold ($10-60K) on "speaker lock (your voice only)" — that feature does not exist in code (whisper + speaker-ID are stubs/absent).
5. **(P2)** Default model fallback `claude-sonnet-4-6` is hardcoded across functions; if not a live Anthropic model ID, every un-overridden call 404s and silently degrades.

---

## Severity-ranked findings

| # | Sev | Area | File:line | Finding | Fix |
|---|-----|------|-----------|---------|-----|
| 1 | **P1** | Honesty/Rule-14 | `aria.html:4209` `renderAutoResolution()`; sample `summary:{ time:'6.4 s', actions:'5', down:'12', cost:'$0.00' }`, audit row `['14:42:08','info','Permission token validated - device-2861-MX']` | Web auto-fix streams a **hardcoded fake "AUDIT TRAIL - LIVE"** with invented timestamps, fake device IDs, and **fabricated "DOWNTIME SAVED" / "TICKET COST"** numbers, ending in a "Done." card. No fix happens; no desktop handoff exists. Card copy (`aria.html:4029`) claims "ARIA performs the fix remotely under audited permissions ... FULL AUDIT TRAIL." | Delete/hard-guard `renderAutoResolution` at source so the fabricated content is never in the DOM. Do not rely on a runtime overlay. If kept as a demo, render an explicit "Illustrative demo - not a live fix" label. |
| 2 | **P1** | Vision gap | (missing) `src/shared/profile.mjs`, `src/shared/session.mjs`, `netlify/functions/sentinel-session-report.*`, `tests/profile-session.test.mjs` | Entire "First-run Profile gate + Session-End Email" feature (spec `dev-docs/sentinel-profile-and-session-email-spec.md`, dated 2026-06-26) is **0% implemented**. Profile gate does not block; session->email path does not exist end-to-end. | Build per spec: mandatory first-run modal -> `profile.json` (LOCALAPPDATA), re-read each launch; session compiler -> `sentinel-session-report` sending two emails ONLY at session end; tests for gate/persistence/payload-content-safety/send-on-end-only. |
| 3 | **P1** | Vision gap (AXIS) | `netlify/functions/axis-director.js:84,145` write `getStore('axis-inbox')`; `scripts/senior-director-worker.mjs` (1322 lines) has **no** `axis-inbox` read | The AXIS "instant approvals / command" hop is **write-only**. Director queues to Blobs; worker only emits `axis-state.json` (`emitAxisState`) and never pulls the inbox. Approvals never execute. | Add an inbox-drain to the worker tick: list `pending/*` -> apply behind existing rails -> ack/delete. Test that a queued approval is consumed within one tick. |
| 4 | **P1** | Merge/release | AXIS files only on `origin/cc/axis-command-center-2026-06-26` | AXIS Command Center is **not on the working branch**. The brief's referenced `netlify/functions/axis-state.mjs` does not exist; the function specced as `axis-state.mjs` is actually a static `axis-state.json` + worker emitter. `axis-command-center.test.mjs` is NOT in the 188-file suite. | Decide merge target; reconcile `axis-state.mjs` vs `axis-state.json`; fold the AXIS test into `run-all.mjs` once merged. |
| 5 | **P2** | Vision gap (AXIS Voice) | `axis/voice-in/whisper-wrapper.mjs:21` `throw new Error("AXIS whisper-wrapper: not implemented (Phase 1 stub)")`; no speaker-ID in `transcript-router.mjs` | Voice Director's marquee privacy features — **speaker lock, wake gate, encrypted brain, TTS round-trip** — are unbuilt. STT is a throwing stub; voiceprint enroll/verify absent. Positioned for $10-60K sale on these claims. | Do not sell/claim speaker-lock until built; or ship the S1-S4 browser MVP and relabel the rest as roadmap. |
| 6 | **P2** | Correctness | `axis-director.js:113`; `aria-chat.js:167`; `aria-cost-*.js` | Hardcoded model fallback `claude-sonnet-4-6`. If not a live model ID, un-overridden calls 404 and degrade to "Brain busy." Gated behind `ARIA_MODEL` env so prod may be fine, but the default is unverified. | Verify `claude-sonnet-4-6` resolves; otherwise set a known-good default + add a model-ping health check. |
| 7 | **P2** | Honesty/fragility | `aria-transform.js:6,60-62` | The Rule-14 fix for #1 is a **client-side overlay** (gray + `pointer-events:none` via MutationObserver). Defense-by-suppression: fabricated content still ships; if the script fails to load/reorders or the observer misses a fast insert, the fake "fix" is reachable. (Credit: the file's own comment is honest about intent.) | Fix at source (#1). Keep overlay only as belt-and-suspenders. |
| 8 | **P3** | Test coverage | `tests/run-all.mjs` | No test for: profile/session-email (feature missing); AXIS inbox-drain (hop missing); AXIS speaker-lock (feature missing); model-ID liveness. `axis-command-center.test.mjs` not in merged suite. | Add tests alongside each fix above. |

---

## Real test / metric numbers observed

- **Sentinel test suite** (`node tests/run-all.mjs`): **PASS — 188/188 test files imported, 0 quarantined.**
- **KB self-test deflection** (`node tools/measure-kb-selftest.mjs`): **68.9%** — `autoResolved 31 / queriesHandled 45`, `escalated 14`, `kbHitRatePct 68.9`, `sampleSize 45`. Honest misroutes surfaced (10 out-of-scope/wrong-topic, e.g. "my car engine won't start" -> boot-issues, correctly escalated). `avgResolutionMs: 1` is synthetic in-memory time — NOT a real device-fix latency; do not present as production resolution time.
- Numbers are content-blind and not fabricated — the proof-metrics test verifies "honest zero" on an empty store.

---

## Prioritized fix list

1. **(P1)** Kill the fabricated web auto-fix at source. Remove/guard `renderAutoResolution`'s fake audit + metrics in `aria.html`. Stop depending on `aria-transform.js` to hide it.
2. **(P1)** Build the Profile + Session-Email feature per spec, with the four specced files + tests.
3. **(P1)** Close the AXIS approve-hop — drain `axis-inbox` each worker tick behind existing rails; add a consumption test. Then merge AXIS and fold its test into `run-all.mjs`.
4. **(P2)** Stop claiming AXIS speaker-lock/voice until built, or ship the S1-S4 browser MVP.
5. **(P2)** Verify the `claude-sonnet-4-6` default model ID is live; add a model health-ping.
6. **(P3)** Backfill tests for every gap above.

---

## Files I could not read reliably
- `aria.html` (~488 KB, very long lines) **truncated repeatedly** on grep/Read; worked around with character-sliced/line-truncated Python reads. Findings on `renderAutoResolution`, the choice cards, and `wireChoices` were verified via targeted Python slices and are sound, but a full line-by-line pass of `aria.html` is advisable to catch any other embedded fabricated-metric blocks.
- All other audited files read cleanly.
