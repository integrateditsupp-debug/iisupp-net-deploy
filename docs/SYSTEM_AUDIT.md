# AXIS Command Center v2 — System Audit (P0)

**Author:** Forge (Lead Product Architect)
**Date:** 2026-07-21
**Branch:** `axis-command-center-v2` (cut from `origin/main` @ `aff5342e`)
**Method:** 5 parallel audit lanes (design file · UI/exposure · functions/bus · workers/deps · state/rules). Read-only. No files modified.

This document is ground truth for what exists **today**. The build plan (`AXIS-CC-V2-BUILD-PLAN.md`) is what we do about it. Where this audit contradicts `FORGE-HANDOFF.md`, this audit wins (the handoff was written before the code was inspected; `FORGE-FINAL-BUILD-PROMPT.md §0` already flagged several of these).

---

## 0. Headline findings (the five that change the plan)

1. **The reference `.dc.html` is NOT liftable verbatim.** It is a proprietary "Design Component" export (`<x-dc>`, `<sc-for>`, `<sc-if>`, `{{mustache}}`, a `style-hover` pseudo-attribute, and a React-like `class Component extends DCLogic`) that depends on a **missing `./support.js` runtime**. It cannot render or run in a browser as-is. Only the **CSS custom-property values** transfer verbatim; all markup and behavior must be ported to vanilla JS + real CSS classes (hover states alone force this — inline styles can't express `:hover`). The handoff line "everything visual is inline styles you can lift verbatim" is true only for token *values*.

2. **Auth already exists and is strong — but the page gate is cosmetic.** `aperture-auth.mjs` issues a self-contained **HS256 JWT** (12 h TTL, single admin credential, `verifyAperture(request)` verifies Bearer server-side per request). Core data endpoints already enforce it. **But** `aperture-learning.html` gates the *page* only by hiding a `<div>` client-side; and several endpoints are wide open (see #3). We do **not** need to build auth — we need to (a) wire the same `verifyAperture` into the new `/api/axis/*` functions and (b) close the open holes.

3. **Four live approval-bypass / abuse holes must close in Phase 1.** These exist in production today:
   - `POST /.netlify/functions/axis-director` — **no auth at all**. An anonymous caller can forge `{action:"approval", decision:"approve", approvalId:"apr-1"}` into the `axis-inbox` Blobs store the local worker executes from → **approval-gate bypass**. Also burns `ANTHROPIC_API_KEY` via `action:"chat"`.
   - `GET/POST /api/mesh-events` — no auth; anyone can **read** agent telemetry and **inject** forged "live activity" into every console.
   - `GET /api/mesh-task-queue` — no auth on read; operator-written task instructions are publicly listable.
   - `POST /.netlify/functions/aperture-email-report` — no auth; open-relay-style abuse of the IIS Resend/Gmail sender identity to any recipient.

4. **The data spine is greenfield, and `publish = "."` makes it dangerous.** No SQLite DB, no `better-sqlite3`, no `data/` directory exist. Netlify's publish dir is the repo root, so **any new `data/` that gets git-tracked deploys publicly.** `data/` must be gitignored *before the first commit*. Precedent: `senior-director-state/` (already ignored).

5. **Branch hygiene is a real trap.** The prior working branch `cc/master-fix-2026-07-02` was repeatedly flagged for **removing ~181 lines from aperture-learning** (Rule 15 risk). Its tip, `origin/main`, and our new branch are all `aff5342e` *right now*, so the commit history is clean — but the **working tree is dirty (~466 files** incl. 3 green uncommitted Sentinel features + scratch logs). Every v2 commit must `git add` explicit paths; never `git add -A`.

---

## 1. The reference design (`AXIS Command Center.dc.html`)

| Property | Finding |
|---|---|
| Size / format | 895 lines, 85.7 KB. Proprietary DC component file, **not** standalone HTML. Requires missing `./support.js`. |
| Screens built | App shell, **S1 Overview**, **S2 Action Inbox** (+ thread view), **S3 Approval Center**, **S14 CRM** (+ record drawer), AXIS dock, toasts, one "Not designed yet" placeholder for the other 13 nav modules. |
| Element markers | **Zero `id=` attributes.** Screens gated by `data-screen-label` + `sc-if` flags computed in `renderVals()`. `data-el` markers: `sidebar`, `brandtext`, `navgroup`, `navlabel`, `opmeta`. |
| Tokens | Full dark + light set at `:root` / `[data-theme="light"]` — **matches `FORGE-HANDOFF §2` exactly** (18 color tokens × 2 themes, Inter + JetBrains Mono). Theming via `data-theme` attr; sidebar collapse via `data-collapsed`. |
| Brand mark | Orbital-A globe SVG at 3 sizes (30/34/24 px): circle `r=13.5` + ellipse orbit + gold "A". Copy exactly. |
| Interactivity present | Nav switching, theme toggle, badge derivation (badge law implemented), inbox chip filters + thread open + Mark-Handled/Snooze/Suppress mutations, approvals tab/expand/bulk + keyboard J/K/A/X/S, CRM tabs/filter/drawer. |
| Interactivity **decorative** (must wire) | Topbar search + ⌘K (a `<div>`, no handler), notifications bell, "last worker tick" (hardcoded text), all Needs-You-Now CTAs, fleet strip counts (hardcoded HTML), **entire AXIS dock chat** (bubbles + OPEN DRAFT/APPROVE chips + input all dead), 5 of 8 thread actions (Draft/Gmail/Schedule/Book/Advance are toast-only), Approvals Edit/Rewrite/Note (E/R/N toast-only), rails chips "cap 12/25 ✓" (hardcoded strings), CRM Add/Export, sidebar collapse toggle. |
| Sample data | Fictional Toronto/GTA SMBs, centralized in `DCLogic` static members (`FILTERED`, `seedMsgs()`, `CRM`, `seedApprovals()`) + inline arrays in `renderVals()`. Clean shapes, **moderate** swap difficulty — but approval bodies are presentation-shaped highlight-segment arrays and provenance is pre-formatted strings, and 4 hardcoded-HTML islands (fleet strip, dock chat, tick, rails chips) must be templated first. |
| Token gap | **No 6-series colorblind-safe chart palette** exists despite `FORGE-HANDOFF §0.5` referencing it. Analytics phase must define it. |

**Implication:** "Match the DC pixel-for-pixel" means *re-implement* its visual system in real CSS/JS, verifying parity against screenshots of our port (we cannot open the reference itself). Roughly half the visible UI is wiring work, not layout work.

---

## 2. Auth reality & data contract

- **Login:** `aperture-learning.html` renders a login card; `doLogin()` (`assets/aperture-learning.js:65`) POSTs `{email,password}` to `/.netlify/functions/aperture-auth`, stores `j.token` in `localStorage['aperture_jwt']` (legacy `aperture_token_v1` still read once). Page shell is `display:none` until authed — **client-side only**.
- **Server:** `aperture-auth.mjs` — creds `APERTURE_ADMIN_EMAIL` / `APERTURE_ADMIN_PASSWORD` / `APERTURE_JWT_SECRET` (503 if secret unset); HS256, TTL `60*60*12`, payload `{sub,iat,exp,role:'admin'}`, timing-safe compare + 400 ms fail sleep. Exports `verifyAperture(request)`. **Stateless — no revocation, no refresh, no rate-limit beyond the sleep.**
- **Poll contract:** `loadAll()` every 4 s hits (Bearer): `aria-learning-status`, `aria-escalation?action=tickets|chatlog`, `/api/senior-director-agent` (digest), `/api/mesh-events?limit=60`. Response shapes documented in the lane output (see appendix key names).
- **Gated correctly today:** `aria-learning-status`, `aria-escalation` admin actions, `axis-state` (`/api/axis-state`), `senior-director-agent`, `aria-mesh-task-queue` POST-enqueue.
- **Dead panels to drop/re-wire in v2:** Infinity Wisdom widget (function + `/infinity-wisdom-public.json` don't exist), ARIA Loop counter (`/tests/run-stats.json` is force-404'd in prod).
- **Login flows we must NOT break** (memory rule): shared `aperture_jwt` + `aperture-auth` response shape `{ok,token,expiresAt,user}` is consumed by `aperture.html`, `aperture-learning.html`, `agent-command-center.html`, `growth-command-center.html`, `command-center.html`, `library-admin.html`. Keep `verifyAperture` semantics intact.

---

## 3. The bus & the write path (reuse, don't fork)

- **Intent inbox (canonical pattern to reuse):** `axis-director.js` writes to Blobs store **`axis-inbox`**, key **`pending/${id}`** where `id = 'axis-'+Date.now().toString(36)`. Message shape: `{ id, ts, action:'command'|'approval', agent, intent(sanitized,≤200), approvalId, decision:'approve'|'reject'|null, source }`. `sanitize()` strips code/URLs/whitespace.
- **Worker consumption:** `scripts/lib/axis-inbox.mjs` — `openAxisInbox()` opens `getStore({name:'axis-inbox', siteID:NETLIFY_SITE_ID, token:NETLIFY_API_TOKEN|…, consistency:'strong'})` (returns null gracefully if unconfigured). `processAxisInbox()` = pure decision fn: `needsApproval || decision==='reject'` → hold; approve/valid-command → execute; then `consumeAxisInbox()` deletes executed keys. Wired into `senior-director-worker.mjs`.
- **Second parallel bus exists:** `senior-director-agent.mjs` `enqueueTask()` writes to **`aria-mesh-queue`** (`queue.json`) with a *different* shape. **Decision needed** (see plan §Decisions): v2 write path should standardize on the `axis-inbox` pending/ pattern and **add `verifyAperture`** — do not copy `axis-director.js` without adding auth.
- **Read path today:** worker's `emitAxisState()` already writes a **public counts-only** `assets/axis-state.json` and a **full** `netlify/functions/_axis-state-full.json` (bundled, served only via authed `/api/axis-state`, with `axisSanitize()` PII stripping). This is the exact snapshot pattern v2 generalizes to `snapshot:{module}` + `snapshot:version` keys.

---

## 4. Workers, fleet & dependencies

- **Worker:** `scripts/senior-director-worker.mjs` — single Node daemon, Windows Scheduled Task at logon, `tick()` every 15 min (env-tunable). Calls Netlify functions **unauthenticated** (public GETs); reaches Blobs via `NETLIFY_SITE_ID` + token. JSONL logging to `senior-director-state/worker.log`, single-instance lock via `worker.lock.json` + PID check. **This is the template Cartographer/Sentry/Miner follow.**
- **Installer pattern:** `scripts/install-*.ps1` (`Register-ScheduledTask -AtLogOn`, hidden powershell, restart-on-fail, Startup-folder `.lnk` fallback) + paired `run-*.ps1`. **Caveat:** `.gitignore` has a blanket `*.ps1` rule (security lockdown) → new installers are **local-only, untracked**. Need a negation rule or they won't survive a clone / can't be reviewed.
- **Roster:** `assets/axis-roster.json` = **exactly 24 agents** + top-level `director` (AXIS) + `executor` (Forge) = **26 named entities** → that resolves the "24 vs 26" discrepancy. A divergent `senior-director-state/axis-roster.json` has 25 (adds `Recycler`). **`emitAxisState()` reads only the `assets/` copy** — new agents must be added there.
- **Deps (`package.json`, node ≥20):** `@netlify/blobs`, `stripe`, `nodemailer`, `pdfkit`, `pdf-parse`, `mammoth`, `jszip`, `busboy`, `framer-motion`. **Missing:** `better-sqlite3`, `exceljs`, `googleapis`, `chart.js` — all needed by v2, all **worker-side or `<script>`-tag only** (never a function dependency).
- **`axis-runner.mjs` (gated autonomy bridge) is NOT on this branch** — only in history (`8cbdeaee`) / other `cc/` branches. If v2 wants it, cherry-pick deliberately.
- **Existing agents that overlap v2** (consolidate, don't duplicate): `scanLeads()` (lead radar → `lead-queue.jsonl`), `opportunity-research/review/prep/quality-agent.mjs` (4-stage opportunity pipeline), `business-development-agent.mjs` (`business-development-crm.json`, no-send draft queues), `trend-radar-mvp.mjs`, `autonomy-supervisor-core.mjs` `publishAgentReport()` (the shared status bus `emitAxisState()` already surfaces — **new agents publish through this, not a new channel**).

---

## 5. Standing rules that bind this build

- **Approval-first / Stop Rule:** stop at send, submit, publish, pay, create account, sign, certify, delete, high-risk claim, external commitment. Sends live **only** behind the Approvals outbound queue + rails, checked **at send time**.
- **Spend cap:** $20–70 CAD/mo; baseline = Netlify, M365, Stripe, Anthropic, DigitalOcean. Everything in this build is **$0** (SQLite, Blobs, existing APIs, Gmail free tier). Ask before any new paid service.
- **Publish is LOCKED:** Netlify auto-publish deliberately off; every prod publish = Ahmad's manual click. **Merge ≠ publish.** Last published: `main @ aff5342e` (2026-07-16/17).
- **Vault privacy (R11):** never a vault note for a real name; leads are `Lead-NNN` handles in `aria-vault/01_Frontal/IIS/Leads.md` (row = handle · status · stage · next · source only). **Mesh today only *relinks* the vault — the CRM "Add note → vault" duty is NEW capability to build**, and it must enforce R11 or it leaks into the demoed Obsidian graph.
- **Off-limits:** `Private pics and Vids/` (no read/list/reference), no Raymond James.
- **Gmail tokens:** local machine only, `data/secrets/` (gitignored) — never Netlify env, never Blobs.
- **Apollo:** **zero repo code / env vars.** Exists only as (a) the claude.ai MCP connector (in-session, OAuth) and (b) descriptive roster text. Any server-side Apollo must be built or driven through MCP.

---

## 6. Consolidation map (nothing lost)

| Old console | Route today | Sections | v2 home |
|---|---|---|---|
| `aperture-learning.html` | `/aperture-learning` | director chat, lead radar, learning loop, tickets/SLA, agents, activity, health | **becomes v2 shell** — Overview, Fleet, Delivery, Approvals |
| `command-center.html` | `/command-center.html` (also reachable directly) | workload thresholds, complaint/review/history boards, mesh topology, tickets, audit/report agents | Fleet, Delivery |
| `agent-command-center.html` | `/command-center`, `/agents` | mesh agents, live activity, task queue, instruct agent, direct triggers | Fleet (agent drawer) |
| `ceo-action-console.html` | `/ceo-action-console.html` (public, but data 404s in prod) | daily action digest, proceed/notes | Overview "Needs You Now" |
| `analytics.html` | `/analytics.html` (public, static demo) | sample metric cards, SLA table | Analytics |

Old consoles stay **untouched until v2 parity**, then become redirects (Phase 8). `ceo-action-console.html` + `analytics.html` are currently publicly served with no protection — Phase 8 redirects fix that.

---

## 7. Risk register (carried into the plan)

| # | Risk | Severity | Mitigation phase |
|---|---|---|---|
| R1 | `axis-director.js` open → approval bypass | **Critical** | P1 (add `verifyAperture`) |
| R2 | `mesh-events` open read/write, `mesh-task-queue` open read, `aperture-email-report` open | High | P1 |
| R3 | `data/` deploys publicly if tracked (`publish="."`) | **Critical** | P1 (gitignore `data/` + `data/secrets/` before first commit) |
| R4 | Reference design can't be verified in-browser | Medium | P2 (parity vs our own screenshots) |
| R5 | Dirty working tree (~466 files) swept into a commit | High | All phases (explicit `git add` only) |
| R6 | `*.ps1` gitignored → installers untracked | Medium | P1 (add negation rule for `scripts/install-*axis*.ps1`) |
| R7 | `aria-lead-capture` never persists → v2 inbox misses chat leads | Medium | P3/P5 (add Blobs write) |
| R8 | Roster divergence (`assets/` vs `state/`); `emitAxisState` reads only `assets/` | Low | P1 (add 3 agents to `assets/axis-roster.json`) |
| R9 | Chart palette undefined | Low | P7 (define 6-series colorblind-safe tokens) |
| R10 | Gmail send crosses "no external send" line | High | P4 (only behind Approvals queue + rails; drafts-then-send) |
| R11 | `.well-known/axis/status.json` leaks internal strategy | Medium | P8 (split public counts / authed narrative) |
| R12 | Stateless 12 h JWT + `unsafe-inline` CSP + token in localStorage = theft window | Medium | Noted; out of scope to fully fix, flag to Ahmad |

---

## 8. Open questions for Ahmad (decisions the plan proposes answers to)

1. **Auth scope:** gate `/api/axis/*` with Aperture JWT alone, or JWT **+** `x-senior-director-secret` (as `senior-director-agent.mjs` does)? *Plan proposes: JWT for browser + dual-accept the secret header for the worker.*
2. **Write bus:** standardize v2 on `axis-inbox` pending/ pattern (worker-consumed) vs `aria-mesh-queue`? *Plan proposes: `axis-inbox`, extended with auth.*
3. **The 4 open holes:** close all four now in P1 (recommended), or only `axis-director`? *Plan proposes: all four.*
4. **`.ps1` tracking:** add a `.gitignore` negation so the 3 new installers are tracked/reviewable? *Plan proposes: yes.*
5. **Roster:** confirm the 3 new agents (Cartographer, Sentry, Miner) are added to `assets/axis-roster.json`, taking the roster to 27 agents. Keep `Recycler` out of the public copy or reconcile? *Plan proposes: add the 3; leave Recycler decision for later.*
6. **Branch/ledger:** `axis-command-center-v2` (no `cc/` prefix per the prompt) — add a `PENDING-DEPLOY-LEDGER.md` row at first commit? *Plan proposes: yes.*
