# AXIS Command Center v2 — Runbook

**Persona:** Forge (Lead Product Architect / Full-Stack Engineer)
**Canonical URL:** `/aperture-learning.html` (serves the v2 shell `axis.html` via Netlify rewrite).
**Stack:** static HTML + vanilla JS + Netlify Functions + Netlify Blobs. Local truth = SQLite
(`node:sqlite`, Node 24). No framework, no bundler.
**Status:** branch `axis-command-center-v2` — **DEPLOY-READY, held for Ahmad**. Not pushed, not on `main`.

---

## What it is

One operational hub with 14 screens, all reading a single authed snapshot API:

| # | Screen | Source of truth |
|---|--------|-----------------|
| S1 | Overview (Command Deck) | KPIs + Needs-You-Now, all from SQLite |
| S2 | Action Inbox | `inbox_messages` (Sentry classifier) — **Badge Law** |
| S3 | Pipeline | `businesses.pipeline_stage` (17 stages / 5 phases) |
| S4 | CRM | contacts / businesses / opportunities |
| S5 | Prospect profile | per-business provenance (source + confidence + last_verified) |
| S6 | Prospects | researched set (Cartographer) |
| S7 | Outreach Studio | `outreach_items` — approved template only |
| S8 | Follow-ups | cadence 3/7/14, max 3, auto-cancel on reply |
| S9 | Documents | 16 Ontario DRAFT templates, versioned |
| S10 | Analytics | 3 dashboards, every number reconciles to SQLite |
| S11 | Product Discovery | Miner — 5-axis weighted scoring |
| S12 | Fleet | 27-agent roster |
| S13 | Reports | exceljs / CSV / pdfkit exports |
| S14 | Settings | rails, quiet hours, identity |

## Architecture

```
SQLite (data/axis-sales.db)  ──►  worker computes snapshots  ──►  Netlify Blobs (store: axis-snapshots)
        ▲                                                                    │
        │ agents write here ONLY                            GET /api/axis/snapshot (JWT-gated)
        │                                                                    ▼
  Cartographer / Sentry / Miner                                      axis-app.js (14 screens)
                                                           POST /api/axis/intent (queues, never sends)
```

- **Dev data override:** `axis-snapshot.mjs` reads gitignored `data/axis-snapshots.local.json` first,
  then falls back to committed `netlify/functions/_axis-snapshots-seed.json`.
- **Committed seed = empty honest baseline** (all zeros). Real prospect data lives in SQLite only and
  never ships in git; in prod the worker publishes real snapshots to Blobs.
- **Auth:** aperture JWT (HS256, `verifyAperture`). Client stores `aperture_jwt` in localStorage; every
  `/api/axis/*` endpoint verifies `APERTURE_JWT_SECRET`. The static shell carries **no** prospect data.

## Agents

| Agent | Script | Installer | Role |
|-------|--------|-----------|------|
| Cartographer | `scripts/cartographer-agent.mjs` | `install-cartographer-worker.ps1` | research + maturity/opportunity scoring |
| Sentry | `scripts/sentry-agent.mjs` | `install-sentry-worker.ps1` | inbox classify + side-effects (dormant until Gmail OAuth) |
| Miner | `scripts/miner-agent.mjs` | `install-miner-worker.ps1` | product discovery (5-axis) |

## Run locally

```bash
# real data view (local override present):
APERTURE_JWT_SECRET=<secret> netlify dev --offline --port 8900
# mint a dev JWT (HS256, same secret) → localStorage 'aperture_jwt' → open /aperture-learning.html
```

## Tests (58 assertions, all green)

`tests/axis-auth` (10) · `axis-snapshots` (9) · `sentry` (14) · `p6` (12) · `analytics` (13).
Run: `for t in tests/axis-*.test.mjs tests/sentry.test.mjs tests/p6.test.mjs tests/analytics.test.mjs; do node "$t"; done`

## Guardrails (enforced)

- **Approval-first:** nothing external sends. `POST /api/axis/intent` only queues; drafts are fail-closed.
- **Badge Law:** red inbox badge only for un-actioned `reply_to_outreach` + `new_inbound_request`;
  zero → no badge element (never a gray "0").
- **Provenance law:** every fact carries source + confidence + last_verified; unknowns render
  "Not found — never guessed".
- **Real data → SQLite ONLY**, never git / vault / Netlify.
- Worker stays **paused**; outreach rails DKIM-gated (first batch ≤5/day, no ramp until DKIM verified).

## HELD for Ahmad (do NOT self-serve)

1. **Production deploy / push to `main`.** Branch is ready; Ahmad publishes.
2. **First real email send.** Needs: DKIM "Start authentication" in Google Admin, Gmail OAuth
   (`scripts/gmail-auth.mjs` → `data/secrets/`), then per-item approval of the ≤5 first batch.

## AXIS dock voice (restored 2026-07-21)

The v1 console's voice chat (push-to-talk mic + humanized spoken replies, commits 4ee1b883 +
0e17c2ca) is fully ported into the v2 dock — free browser Web Speech API, no paid API, no LLM:

- **🎙 mic** (`#axisMic`): push-to-talk; transcript fills the dock input and auto-sends to
  `axis-director`. Starting the mic barges in over any current spoken reply.
- **🔊 toggle** (`#axisVoice`): spoken replies, ON by default. Neural/Natural > Google > premium
  voice ranking; manual override persists in `localStorage['axis-voice-name']` (same key as v1 —
  a voice picked on the old console carries over). `axisVoiceNext()` / `axisSetVoice(name)` in
  DevTools to cycle/set.
- Replies are humanized for speech (glyph/markdown strip, "24/7" → words, % → percent) and
  sentence-chunked (~180 chars) so Chrome never cuts long utterances.
- Guard: `tests/axis-voice-dock.test.mjs` (fails if the dock ever drops voice again, or if the v1
  console loses its own voice code).

## AXIS JARVIS flow + woman's voice (2026-08-11)

Ahmad: *"add Jarvis but keep the name AXIS, give it a unique woman's voice, proper Jarvis flow —
do not remove existing functions."* Built **purely additively** on the dock voice above; every v1
behavior listed in that section is unchanged and still guarded by `tests/axis-voice-dock.test.mjs`.

New module `assets/axis-persona.js` (persona + turn grammar only — it never sends, approves, or pays):

- **The voice.** A woman's voice in an **en-GB** register — Microsoft Sonia / Libby Online (Natural)
  first, prosody `rate 1.0 / pitch 0.92`. Deliberately apart from the customer ARIA orb
  (`aria-core.js`: en-US, Samantha/Zira/Karen, `rate .95 / pitch 1.05`), so the director and the
  product never sound alike. ARIA's own voice names are **demoted −45, not banned** — a bare browser
  still falls back to a real female voice instead of dropping to a male or legacy-SAPI one.
  `axisPersonaBonus()` is applied *last* inside the existing `axisScoreVoice()` ranking, so
  neural > google > premium ordering is extended, not replaced.
- **Hands-free turn-taking (`⌁` button, OFF by default).** Wake word "AXIS" / "hey AXIS" on a
  background continuous recognizer → dock opens → ask → instant spoken ack (no dead air) → answer →
  the mic reopens automatically so the next sentence needs no button. Push-to-talk and the wake
  listener yield to each other (one `SpeechRecognition` at a time). OFF by default because it holds
  the microphone open; the choice persists but never auto-starts (browsers require a gesture).
- **Boot briefing.** Once per authed session, from the real snapshot KPIs. Rule 14: with no snapshot
  it says *"I do not have the board yet"* — it never reports "all quiet", which would be a claim
  about data it does not have.
- **Hard-stops stay hard-stops, spoken.** A routed intent may be confirmed by voice ("confirm" /
  "cancel") because the worker still runs it behind its rails. Anything the director flags
  `needsApproval` is **click-only** and AXIS says so aloud. Voice never self-authorizes.
- **Kill-switch.** Say "AXIS stop" (or stand down / cancel / quiet) or press **Ctrl+Alt+K**. Both
  abort speech, the mic, the pending turn, and any unconfirmed route. Ctrl+Alt+K is checked *before*
  ⌘K so it never opens the palette instead, and works from inside a text field.
- Addresses Ahmad by name — never "sir", never "boss" (vault `07_Cortex/AXIS.md`).

Shell change: one `#axisWake` chip added to the dock input row in **both** `axis.html` and
`aperture-learning.html` — those two files are byte-identical and both are served; a test asserts
they stay that way.

Guard: `tests/axis-jarvis-flow.test.mjs` (6 groups). Group 6 is an explicit no-regression check that
every v1 voice marker is still present in `axis-app.js`.

## AXIS console redesign + "it does not hear me" fix (2026-08-11)

Ahmad, after using the first build: *"on edge its one voice and chrome another… when I speak to it,
it does not hear me or respond… its just a small little window at the bottom center… add a priority
section of all items being worked on and due dates."* All four addressed; still purely additive.

**1. Why it could not hear you — the wake-word homophone bug.** Browser speech-to-text almost never
returns the literal string `axis`. Chrome and Edge transcribe it as **"access", "axes", "acts",
"exes", "ax is"**. The matcher only accepted `/axis/`, so the wake listener heard every word and
silently ignored all of it — indistinguishable from a dead mic. `WAKE_WORD` in `axis-persona.js` is
now a deliberately generous alternation (a false wake costs one ignored question; a missed wake makes
the whole feature look broken). `STOP_RE` and `stripWake()` share it. Guard:
`tests/axis-voice-hearing.test.mjs`.

**2. Failure is now visible.** `interimResults` is on, so your words appear in the box and in a live
line under the orb as you speak. Every recognition error is translated to plain language with the fix
(`not-allowed` → "click the padlock, allow the mic, reload"), a silent close says "I did not catch
that", and AXIS deafens the wake listener while speaking so it cannot wake itself on its own voice.

**3. Voice parity — as close as free TTS allows.** Edge ships the "Online (Natural)" neural set
(Sonia/Libby); Chrome ships Google's network voices. The *same* voice in both is impossible without a
paid cloud TTS ($0 rule). Instead `VOICE_PROFILES` corrects each family toward Edge's Sonia as the
reference — Google's voices run fast and bright, so they are slowed and lowered the most — and a
**voice picker in the console footer** lists what this browser actually has, best-first, speaking a
sample on selection (pinned via the same `axis-voice-name` key as v1). `polishForSpeech()` says
jargon like a person ("KB" → "knowledge base", "$12k" → "12 thousand dollars", "3-5" → "3 to 5") and
`phraseChunks()` breathes at clauses, not only full stops.

**4. The console.** `.axis-dock` is now a full-height right rail (was a ~520px box at bottom center):
orb hero with a state-driven level meter, a **top-priorities rail**, roomier transcript, and the voice
picker footer. Every element id is unchanged — this is a skin plus additions, so all prior guards
still hold. `:root[data-axis-dock="open"]` yields the content pane's width so the console **docks
rather than covers** (it was clipping the right-hand KPI cards).

**5. S15 Priorities** (`assets/axis-priorities.js`, 17th tab, head of Workspace). One queue of every
open item ordered by due date, plus a "Being worked on" section from the fleet. It **invents
nothing**: every date is that record's own field, and approvals/inbox — which genuinely have no
deadline field — render "no due date" and sort last rather than being given a plausible one.
Guard: `tests/axis-priorities.test.mjs`.

Two real bugs the tests caught and fixed: `new Date(null)` is the 1970 epoch (not invalid), so an
undated item rendered **"20677 days overdue"**; and `ago()` assumed epoch ms, so ISO timestamps
rendered a literal **"NaNd"** — that one was already live on Approvals and Inbox, now fixed for all
three. Suite: 17/17 green, headless-Chrome boot verified (4 orbs mounted, 0 JS errors, 0 NaN in DOM).

## AXIS status feed — headline-only law (2026-07-21)

The public mirrors `.well-known/axis/status.json` + `public/.well-known/axis/status.json` are
HEADLINE-ONLY (status / milestone / readiness / revenueToDate / headline / note). The ONLY
sanctioned writer is `scripts/lib/axis-status-emit.mjs` — it allowlists keys, caps lengths, and
REFUSES leak-class content (git SHAs, `cc/` branch names, operator `.cmd`/`.ps1` names, git/lock
state, run counters, internal paths). Full flywheel detail goes to
`netlify/functions/_axis-status-full.json` (force-404 live) and is served only via the
authenticated `/api/axis-status` (Aperture login, same gate as `/api/axis-state`).

**Flywheel/observer rule:** never hand-write the `.well-known` mirrors. Emit with
`node scripts/lib/axis-status-emit.mjs emit --fields <headline.json> --full <detail.json>`, and
verify with `… check`. `tests/deploy-safety-denylist.test.mjs` imports the same leak patterns, so
a bypassing writer fails the suite; `tests/axis-status-emitter.test.mjs` proves the refusal logic.

## Known follow-ups (not blockers)
- Old consoles (`/command-center`, `/agents`, `/agent-command-center.html`) keep their Basic-auth edge
  gate (`aperture-gate.ts`) and then 301 → `/aperture-learning.html`. The double auth on those
  deprecated URLs is harmless; the login edge function was intentionally not modified.
