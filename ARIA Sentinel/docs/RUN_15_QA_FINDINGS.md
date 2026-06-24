# RUN 15 · Live QA Findings on RUN 14 install

> Cowork tested the freshly installed v0.1.0 RC (commit 4547065). Notes captured here become the RUN 15 packet basis.

## What works (RUN 12+13+14 holding)

- ✅ Settings window opens at default size, left rail visible (no clip)
- ✅ All 10 tabs present in correct order: Control Center · Mode · Recipes · Knowledge & policy · Privacy verifier · Hotkeys · Troubleshoot · ServiceNow · Support · About
- ✅ Branded gold header: globe + "Integrated IT Support Inc." + "Manual mode - paused"
- ✅ Trial badge visible top-right: "TRIAL · 10H 55M LEFT"
- ✅ Bridge + dry-run safe badges present
- ✅ Mode tab shows 3 modes with per-mode globe behavior descriptions
- ✅ "Ask ARIA" chat dock present below mode cards
- ✅ Tab nav clickable (Mode highlighted in gold)

## What's broken or needs RUN 15 work (Ahmad's list + observed)


### Cowork QA observations (2026-06-19 ~22:30 ET, post-RUN-14 install)

**RUN 12-14 visible & holding:**
- Layout, branded header, 10-tab IA, trial countdown, mode descriptions, chat dock structure all in place
- Trial badge ticking down: 10H 55M → 10H 54M observed (real timer)
- Status table (single-instance / bridge / overlay / main-window / dry-run / content-boundary) all OK

**What Ahmad flagged + what I confirmed:**

1. **Self Check button** — clicks but does not actually traverse buttons/IPC/features. Currently runs the legacy 7-point health check (bridge/watchers/etc.). NEEDS: full self-audit + auto-heal + escalation
2. **Globe location** — currently uses RUN 12 free-roam (drifts around desktop). Ahmad wants: TOP-CENTER of THE WINDOW · move away from cursor · TELEPORT BACK to center after 2s
3. **Greetings missing** — globe is silent. Ahmad wants: "hi" on launch + periodic "anything you need? I'm here" + 10-min "want to talk or search?" bubble
4. **Admin console accessible to everyone** — "OPEN ADMIN CONSOLE" button visible in every install. Ahmad wants: Ahmad-only via admin credentials; NEVER shipped to user licenses
5. **"Resume Watching" wording wrong** — Ahmad wants: rename to "Stop ARIA" + "Start ARIA" (when stopped globe disappears, when started globe appears + monitoring begins)
6. **Chat in Mode tab is local/canned** — example exchange visible is hardcoded. Ahmad wants: LIVE iisupp.net/aria connection (desktop wraps the website's brain)
7. **Hotkeys don't actually fire** — Ctrl+Alt+A/G/P documented but globalShortcut binding either failed silently or focus-blocked
8. **Globe icons in app** — bottom-left rail shows the new gold "A" build icon. Ahmad wants: LIVE iisupp.net/aria globe (the rotating SVG with breathing core) in top-left header + bottom-left footer
9. **Same brain across versions** — desktop must feel like the website's ARIA downloaded, not a different product
10. **"Investigating" + 4-tier escalation flow** — chat reply pattern needs: KB-first → event-log → Research-agent (web/ChatGPT trusted sources) → ticket bin + "call 647-581-3182 / email" if unsolved
