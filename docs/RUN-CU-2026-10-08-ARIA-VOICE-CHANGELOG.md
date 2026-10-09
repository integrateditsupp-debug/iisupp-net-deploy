# RUN-CU 2026-10-08 — ARIA conversational voice mode (iisupp.net/aria) changelog

Branch `cc/run-cu-2026-10-08` (base `00f5cf6`). Executes the ARIA-page part of the site audit (`review-site.md`
Top-10 #6, §6 accessibility) plus the client half of today's backend hardening (`aria-chat` VOICE MODE + sessionId
trust rule; `lib/require-verified-email.cjs` on the account endpoints).
Files touched: `aria.html`, `account.html`, `aria-data-export.html`, `assets/aria-session-memory-client.js`,
`assets/aria-core.js` (the homepage widget's chat post — one field), `docs/openapi.json` (one entry), this file.
New: `assets/aria-voice-conversation.js`, `assets/aria-account-auth.js`, `tests/aria-voice-conversation.test.mjs`,
`tests/aria-page-honesty.test.mjs`, `tests/aria-web-session-id.test.mjs`.
Not touched: `netlify/functions/**`, `ARIA Sentinel/**` (the modified Sentinel files in the working tree belong to
another agent's run), `aria-brain.js`, every other page, the viewport meta. Nothing committed.

Rules applied: **14** (real-or-empty: every transcript row and stamp comes from the live clock / the user / the
server; the demo feed and demo ops view are labelled as such), **15** (additive: every view, button, section and
function kept; the original one-shot recognition path is still reachable), **17** (value first: a working
hands-free troubleshooting loop before polish).

---

## 1. What changed in `aria.html` (line refs are in the working tree)

| Area | Change | Lines |
|---|---|---|
| Session identity | `sessionId: 2861` + `'web-' + state.sessionId` are gone. `makeWebSessionId()` = `'web-' + crypto.randomUUID()` (fallback: 24 random base36 chars), `getWebSessionId()` keeps it in **sessionStorage** `aria_web_session_id` (per tab, never localStorage), re-validated against the server rule `/^[A-Za-z0-9_-]{16,80}$/`; `rotateWebSessionId()` replaces the old `state.sessionId++` in `newSession()` (a new incident = a new server context, same semantic as before). `sessionLabel()` shows the 6-char tail in `SESSION · #…` / the fake URL bar; the markup placeholder is `#------` until JS stamps the real one. Exposed as `window.ariaWebSessionId` for asset clients. Typed LLM path posts `sessionId: state.sessionId`. | 2984-3020, 3068, 4375 |
| Voice engine | `<script src="/assets/aria-voice-conversation.js" defer>` — loaded as an external asset **because the page already loads `/assets/*.js` the same way** (`aria-aperture-bridge.js`, `aria-v04-ext.js`, `aria-web-tier.js`, …); the identical file is what node unit-tests. The engine is a DOM-free state machine (idle → listening → thinking → speaking → listening / ended) with injected SpeechRecognition / speechSynthesis / fetch / timers / clock. | 5804 |
| Glue | `window.__ariaVoiceGlue` wires the engine to `#view-voice`, `#voiceQuote`, `#transcriptList`, `#voiceTimer`, `#micBtn`, `#muteBtn`, the new `#voiceEndBtn` / `#voiceStatePill`, the chat view (every voice turn mirrored as a normal YOU / ARIA message so the written `text` steps stay readable), `#ariaHandoffBtn` (action `escalate`) and `openResolveModal()` (action `sentinel-fix` — never pretends to run anything). Spoken line for sentinel-fix: *"On a computer with ARIA Sentinel I can run that fix for you — want the download link?"*; for escalate: the Get-a-human line. Honest error copy for unsupported / mic denied / no microphone / recognition network / server unreachable. `window.__ariaVoiceMode = true` before every utterance because `aria-v04-ext.js` gates `speechSynthesis.speak` behind that flag. | 5806-6020 |
| `enterVoice(initialText)` | The scripted *"I see what's going on…"* reply and the fake `00:04` / `00:11` stamps are gone. `voiceSeedText()` treats a pure "voice mode / switch to voice / use voice / voice chat" as a command (start listening); anything longer is the first user turn and is sent to `aria-chat`. Without the engine (no Web Speech API, or `?voice=oneshot` / `localStorage aria_voice_engine=oneshot`) the view says *"Voice input isn't supported in this browser — typing works."* and adds a SYSTEM row — nothing invented. `addTranscript()` gained an optional `kind` ('system') and escapes `who`/`ts`. | 5469-5526 |
| Tap-to-speak | `#micBtn` click starts the **conversation** when the engine is available (continuous recognition), a second tap ends it; the original one-shot `ensureRecognition()` path is the fallback (its `'--:--'` stamp is now the real clock). `#muteBtn` and the new `#voiceEndBtn` end the conversation; **Escape** ends it then returns to chat (the lead modal captures Escape first when open). Typed text while a conversation is live joins that conversation (`submitAsk` → `__ariaVoiceGlue.submitTyped`). | 5658-5663, 5695-5722, 5766-5770 |
| Honesty labels (audit #6) | Right rail: `LIVE ACTIVITY · Updated 0s ago` → **`SIMULATED DEMO FEED` · "Sample figures · not live"**; the ticker no longer writes "Updated Ns ago" (random-walk counters kept, labelled). Ops topbar: `ENTERPRISE OPERATIONS · LIVE` → **`DEMO OPERATIONS VIEW (SAMPLE DATA)`**; ops banner gains a visible note "Sample data for demonstration — the figures below are illustrative, not measured from live systems." Every element kept. | 2046, 2124-2125, 2727-2731, 5458 |
| Voice view additions | `#voiceControls` (state pill with `aria-live="polite"`, keyboard-operable **End voice** button) and the caption *"Speech recognition is provided by your browser (Chrome/Edge send audio to the browser vendor); the conversation goes to ARIA."* CSS added (`.voice-controls`, `.voice-state-pill[data-state]`, `.voice-caption`, `.transcript-row.system`, focus rings) — nothing rewritten. | 916-927, 2031-2035 |
| Accessibility (audit §6) | `#askInput aria-label="Ask ARIA"`, `#sendBtn aria-label="Send"`, `#micBtn` `type="button"` + `aria-label` + `aria-pressed` (toggled by the glue), `#muteBtn aria-label`. Lead modal: `aria-labelledby="alm-title"`, `for=`/`id` on all five labels + `autocomplete`, open → focus first field, Tab trapped inside, **Escape closes the modal** (used to switch the chat view underneath), focus returns to the opener. Voice panel: focus moves to End voice on start, Tab cycles End voice ↔ Mute while live, focus returns to the mic after the conversation ends. | 1998-1999, 2155, 2299, 6312-6355 |
| Magic-link landing | `/aria?magic=<token>` (the shape `aria-magic-link` emails) is verified on load via `assets/aria-account-auth.js`, the 12-h `session_token` is kept (`localStorage aria_session_token` — the site convention `assets/forums.js` already reads), the token is stripped from the URL, a toast says "Signed in as … · Continue to /account.html (or the page that asked)". | 6022-6056 |

### Voice loop behaviour (engine `assets/aria-voice-conversation.js`)
- listening: `continuous:true`, `interimResults:true`, `lang` = `navigator.language` (fallback `en-US`); turn ends on a FINAL result + **1.6 s** silence (more speech pushes it); typed/initial text commits immediately.
- thinking: `POST /.netlify/functions/aria-chat` `{messages (last 12 turns), sessionId, voice:true, platform, device:{os, app}}` — platform from `navigator.userAgentData.platform` / `navigator.platform`, device = one line like `web browser (Google Chrome, desktop, voice mode)`.
- speaking: `speak` from the server (fallback: first two sentences of `text`, markdown stripped, ≤55 words), chunked by sentence; two watchdogs (utterance never starts → 2.5 s; `onend` never fires → words×600 ms + 4 s) so the loop cannot hang.
- barge-in: recognition stays live while ARIA talks; ≥10 chars of real speech cancels synthesis and becomes the next turn. Text that is ≥60 % ARIA's own words (speaker echo) is ignored, and a barged-in turn that resolves to echo is **dropped, never sent**.
- re-arm: `listen:true` → listening again after a **300 ms** gap. Ends on `needs_input:false`, `degraded`/`offline` replies (the degraded `speak` is spoken first), end phrases ("that's all", "stop", "thanks, bye", "goodbye", "I'm done", … — ≤6 words, anchored), Escape / Mute / End voice / mic tap, or **two consecutive empty turns** (no-speech). `listen:false` with `needs_input:true` → ends with "ARIA is waiting for a typed answer".
- history: the engine shares `state.llmHistory` with the typed LLM path (seeded from it, written back after each turn).

## 2. Other files

| File | Change |
|---|---|
| `assets/aria-account-auth.js` (new) | `requestMagicLink(email,{returnTo})` → `aria-magic-link {event:'request'}`; `consumeMagicLinkFromUrl()` → `{event:'verify', token}` → keeps `session_token` (+ `aria_session_email`), strips the URL; `postAccount(fn, body)` adds `body.token` + `X-ARIA-Session-Token` only when the held token is for that email, maps **401 `verification_required` → `{needs_signin:true}`** and 503 `not-configured` → an honest message; `mountSignIn(container, opts)` = email field + "Send me a sign-in link" + status line ("Check your inbox — … nothing is unlocked until the link is clicked"). Token payload is only decoded for email/exp — verification stays server-side. |
| `aria-data-export.html` | New section "0 · Prove it is your mailbox" (signed-in state / sign-in form, sign-out). Export and delete: no token for that email → **"Sign-in link required … nothing was exported or deleted"** (scrolls to the sign-in card, prefills the email); with a token → `postAccount('aria-data-export'|'aria-account-delete')`; server 401 → the same honest state, token cleared. Handles `?magic=` too. Existing cards, copy and the client-side localStorage dump kept. |
| `account.html` | Sign-in card + billing-email field + status area; the "Open billing portal" / "Invoice function" anchors keep their `href` but now POST with proof (`data-account-action`): billing portal (`return_url` = /account.html, renders the Stripe link), invoice list (number · amount · status · view / PDF), **new** plan-change card (tier select → `aria-plan-change {email,new_tier,token}` after a confirm), "What a sign-in link protects" list. All existing sections kept. |
| `assets/aria-session-memory-client.js` | `load`/`clear` send `token` (+ header) when one is held for that email, every request carries the page's per-tab `sessionId`; a 401 or a missing token is reported through `ariaSessionMemory.status()` / `canReadBack()` (`needs_signin:true`) and the welcome-back banner is simply not shown — never "empty memory" by mistake. `save` unchanged (write-only). New `load`/`clear` exports. |
| `assets/aria-core.js` | The homepage widget's `aria-chat` post now carries its own per-tab `sessionId` (same generator, sessionStorage) so the server can keep context for that tab; previously it sent none. |
| `docs/openapi.json` | `/.netlify/functions/aria-winback-cron` (file `aria-winback-cron.js`) → `/.netlify/functions/aria-winback-draft` (file `aria-winback-draft.js`, operationId `post_aria_winback_draft`) — the function was renamed on 2026-10-08. |

## 3. Tests

- `tests/aria-voice-conversation.test.mjs` — **60 checks**, node only (fake SpeechRecognition / speechSynthesis / fetch, deterministic clock): helpers, no-API → zero network, happy path with real stamps, end phrases, 12-turn trim, barge-in + echo guard + echo-drop, silence exit, mic-denied / degraded / HTTP 500 / network / no-`speak` fallback / swallowed-utterance watchdog / no-synthesis, actions + `augmentSpeak`.
- `tests/aria-page-honesty.test.mjs` — **33 checks**: no "Updated 0s ago", canned reply gone, DEMO labels present, generator present, caption + honest copy present, a11y attributes, viewport untouched, and **every inline `<script>` of aria.html is parsed by `node --check`** + tag-count balance.
- `tests/aria-web-session-id.test.mjs` — **19 checks**: constant gone, per-tab generator, sessionStorage only, every chat post carries it.
- `node scripts/run-tests.mjs --all` → **124/129** (baseline 121/126 + the three new suites; the same 5 env-only `axis-*` reds). `first-screen-audit`, `surface-class`, `customer-link-graph`, `conversation-path`, `asset-parse-gate`, `aria-chat-voice-contract`, `function-gates` green.
- Additionally exercised (not in the repo, jsdom in the scratchpad): the full page loaded with fakes — mic tap → listening → turn → `aria-chat` body → chat mirror → speaking → re-arm → sentinel-fix / escalate → resolved → focus back to the mic; Escape; no-API fallback; `?voice=oneshot`; typed voice commands; mic denied; barge-in; Mute; lead-modal focus/Escape; account pages: sign-in-required states, magic-link request, `?magic=` consumption, `body.token` on export/delete/portal/invoices/plan-change, 401 → sign-in state. 69/69.

## 4. How to test manually (Chrome / Edge desktop)

1. Open `/aria` (or `/aria.html`), allow the microphone when asked. Tap the gold mic. The voice view opens, pill says **LISTENING**, the SESSION clock runs, the transcript shows a SYSTEM row "Voice conversation started".
2. Say *"my printer is jammed"* and pause. After ~1.6 s the pill flips to THINKING, then ARIA SPEAKING; you hear the `speak` line; the transcript shows YOU / ARIA rows with mm:ss stamps; switch to the chat (Escape) to see the same turns as normal messages with the full written steps and suggestion chips.
3. Stay in the view: ARIA re-opens the mic ~0.3 s after finishing. Interrupt it mid-sentence with a full sentence — speech stops, pill says LISTENING, your words become the next turn. Short noise or ARIA's own words echoed through speakers are ignored.
4. Say *"that's all"* → "Voice ended · you ended it", chat view returns, focus is on the mic. Also try Escape, Mute, End voice, and 2 × silence (~16 s) → "no speech for two turns".
5. Type into the chat box while voice is live → ARIA answers by voice and in the chat.
6. Ask for something Sentinel can run (*"flush my DNS"*): ARIA offers the download link by voice and the reply carries the "ARIA Sentinel options" button (existing modal: Open / Download / Walkthrough). Ask for a human: the Get-a-human button is shown.
7. Block the mic in site settings and tap again → "Microphone access was blocked …"; Firefox/Safari → see §5.
8. Right rail now reads SIMULATED DEMO FEED · Sample figures · not live; the ops view topbar reads DEMO OPERATIONS VIEW (SAMPLE DATA).
9. Accounts: `/aria-data-export.html` → Export without signing in → "Sign-in link required". Enter your email in section 0 → "Check your inbox" (needs `APERTURE_JWT_SECRET` + `RESEND_*` on Netlify) → click the link → `/aria?magic=…` shows "Signed in as …" → back on the export page the state is "Signed in"; Export now works; `/account.html` portal / invoices / plan change post with the token.

## 5. Honest limits

- **Chrome / Edge**: full loop. Their Web Speech API sends microphone audio to the browser vendor's service — the caption says so.
- **Safari (macOS/iOS)**: `webkitSpeechRecognition` exists; continuous mode is less reliable (sessions end early, interim results sparse) — the engine treats an early end as an empty turn and re-arms; two in a row end the loop honestly. iOS also needs a tap before speech output.
- **Firefox**: no SpeechRecognition → "Voice input isn't supported in this browser — typing works." Typed replies can still be read aloud (existing `speak()`), zero network from the voice path.
- Speaker echo: the barge-in guard is a word-overlap heuristic plus OS echo cancellation; with loud speakers and no headphones a mis-recognised echo can still interrupt ARIA (it is never sent as the user's words).
- The page is still `viewport width=1280` (audit P1 #5, not in this packet) — the voice controls use flex-wrap but the whole page scales on phones.

## 6. Needs Ahmad / follow-ups (not done here)

1. **Netlify env**: `APERTURE_JWT_SECRET` (magic links + session tokens), `RESEND_API_KEY` + verified-domain `RESEND_FROM` (the sign-in email), `ARIA_MODEL` (otherwise every voice turn gets the offline-brain reply and the loop ends after speaking it). If a live customer flow breaks before the token flow is verified end-to-end, `ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1` is the emergency toggle (flip it back).
2. Verify one real magic-link round trip in production (request on `/aria-data-export.html` → inbox → `/aria?magic=` → export) — the client is tested against fakes only.
3. Listen to the voice in Chrome once and decide the preferred TTS voice (`pickVoice` prefers Microsoft Aria/Jenny/Sonia/Libby Natural, Google US English, Samantha).
4. Remaining fabricated-looking copy on the ARIA page **not covered by this packet** (flagging, not changed): the right-rail "SYSTEM STATUS" panel (`refreshStatus()`, line 2961) picks a random "All systems operational" / sample OneDrive issue every 22 s; decorative pills "SENTIMENT · CALM ↑", "CLARITY · 98%", "PACE · 92 WPM", "PRIORITY · GOLD" in the voice view/rail are not measured. Decide: relabel as sample, or remove.
5. `openapi.json` is generated by `scripts/finish100-generate-assets.mjs`; the next regeneration will also list the scheduled `aria-winback-cron.mjs` as an HTTP path again (the generator lists every file) — a generator exclusion for `*.mjs` scheduled functions would be the durable fix.
