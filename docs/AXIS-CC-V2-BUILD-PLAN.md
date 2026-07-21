# AXIS Command Center v2 — Build Plan (P0)

**Author:** Forge · **Date:** 2026-07-21 · **Branch:** `axis-command-center-v2` @ `aff5342e`
**Companion:** `SYSTEM_AUDIT.md` (ground truth). This doc = what we build, in what order, touching which files.

**Gate:** This plan is the P0 deliverable. **No code ships until Ahmad approves this plan and the decisions in §2.**

---

## 1. Architecture at a glance (the data spine)

```
                         LOCAL MACHINE (this PC)                    NETLIFY (stateless)                BROWSER
  ┌──────────────────────────────────────────┐        ┌──────────────────────────────┐      ┌───────────────────────┐
  │ senior-director-worker.mjs  (15-min tick) │        │ Functions (all .mjs)         │      │ aperture-learning.html │
  │  ├─ SQLite  data/axis-sales.db  (TRUTH)   │        │                              │      │  = AXIS Command Center │
  │  │   better-sqlite3 (worker dep ONLY)     │        │ /api/axis/snapshot?module=   │◀─────│  polls version q.15s   │
  │  ├─ Cartographer / Sentry / Miner agents  │        │   (verifyAperture) serves    │──────▶│  refetch changed only  │
  │  ├─ Gmail tokens  data/secrets/ (git-ign) │        │   Blobs snapshot:{module}    │      │                       │
  │  │                                        │        │                              │      │  every action POSTs →  │
  │  ├─ WRITE snapshots ──────────────────────┼───────▶│ Blobs: snapshot:{module}     │      │                       │
  │  │       + bump snapshot:version          │        │        snapshot:version      │      │ /api/axis/intent       │
  │  │                                        │        │ Blobs: axis-inbox pending/*  │◀─────│  (verifyAperture)      │
  │  └─ PULL intents each tick ◀──────────────┼────────│ /api/axis/intent appends     │      │  optimistic UI + toast │
  │      apply to SQLite, execute behind rails│        │   (verifyAperture)           │      └───────────────────────┘
  └──────────────────────────────────────────┘        └──────────────────────────────┘
```

**Invariants:** SQLite = truth; Blobs snapshots = derived read cache; UI optimistic state always yields to the next snapshot. The UI never executes anything — it only appends intents. SQLite and secrets never touch Netlify functions/env/Blobs.

---

## 2. Architecture decisions (trade-offs — approve or redirect)

**D1 — Auth for `/api/axis/*`.** Reuse `verifyAperture` (HS256 Bearer). Browser sends the existing `aperture_jwt`. The worker (no browser) needs a way in too. **Proposal:** dual-accept — `verifyAperture(req)` **OR** `x-senior-director-secret === SENIOR_DIRECTOR_SECRET` (the exact pattern `senior-director-agent.mjs` already uses). *Alt:* JWT-only (worker doesn't call these — it uses Blobs directly, so JWT-only is viable and simpler). **Recommend:** JWT-only for `/api/axis/*` since the worker reads/writes Blobs directly and never needs the HTTP endpoints. Less surface. → *decision needed.*

**D2 — Write bus.** Two exist: `axis-inbox` (pending/, worker-consumed, has `processAxisInbox` rails) vs `aria-mesh-queue`. **Recommend:** `axis-inbox`. `/api/axis/intent` appends `{type, payload}` in the established shape **plus `verifyAperture`**. Reuses the audit trail + rails the worker already runs. One queue, one trail.

**D3 — Close all four open holes in P1**, not just `axis-director`. `axis-director.js` + `aria-mesh-events` + `aria-mesh-task-queue` (GET) + `aperture-email-report` each get `verifyAperture` (or dual-accept for worker-called ones). These are live approval-bypass / abuse surfaces; leaving them while adding a real data console is indefensible. **Recommend:** yes, all four.

**D4 — SQLite location & safety.** `data/axis-sales.db`. **First commit adds `data/` and `data/secrets/` to `.gitignore`** (publish=`.` makes an untracked-but-present dir safe; a *tracked* one deploys). `better-sqlite3` added under a **worker-only** dependency boundary; `netlify.toml` `external_node_modules` must **exclude** it from function bundling (belt-and-suspenders: no function imports it).

**D5 — Port strategy for the DC file.** Extract token values to `assets/axis-tokens.css` (real `:root`/`[data-theme]`). Re-implement each component as a real CSS class + a vanilla-JS render function (one module = one data contract + one render fn). Do **not** attempt to run the DC runtime. Parity verified against **our** Playwright screenshots.

**D6 — Chart palette.** Define a 6-series colorblind-safe palette (Okabe–Ito derived, gold-anchored) in `axis-tokens.css` at P7. Chart.js UMD via `<script>`.

**D7 — Roster.** Add `Cartographer`, `Sentry`, `Miner` to `assets/axis-roster.json` (→ 27 agents + AXIS + Forge). Add a `.gitignore` negation so `scripts/install-{cartographer,sentry,miner}-worker.ps1` are tracked.

**D8 — Snapshot module set.** One Blobs key per module: `snapshot:overview`, `:inbox`, `:approvals`, `:pipeline`, `:prospects`, `:outreach`, `:followups`, `:documents`, `:analytics`, `:products`, `:fleet`, `:reports`, `:crm`, `:settings` + `snapshot:version` (monotonic int). UI polls version; refetches only modules whose per-module version changed (store a `{module: v}` map inside the version payload).

---

## 3. Shared vocabulary (built once, in P1)

`assets/axis-constants.js` (browser) + `scripts/lib/axis-constants.mjs` (worker) — **one source, mirrored**, holding: the 17 pipeline stages in 5 phases, rejection-reason enum, rails names, classification labels, channel types, document types. DB schema, worker, snapshots, UI chips, and Excel export all import from here — no drift.

Pipeline enum (canonical): `Researching, Profile Completed | Email Generated, Waiting Approval, Approved, Ready to Send, Sent, Delivered, Opened | Replied, Follow-up Required, Meeting Scheduled | Proposal Sent, Negotiation | Won, Lost, Archived`.

---

## 4. Phased build (hard gate after each)

### P0 — Audit + plan ✅ (this document + `SYSTEM_AUDIT.md`)
**Gate:** Ahmad approves this plan + §2 decisions. ← **we are here**

### P1 — Spine + security
Files: `.gitignore` (+`data/`, +`data/secrets/`, +ps1 negation) · `netlify.toml` (auth-gate console route, 404-force `data/`, `SECRETS_SCAN_OMIT_KEYS` for new non-secret names) · **new** `netlify/functions/axis-snapshot.mjs` (`GET /api/axis/snapshot`, `verifyAperture`) · **new** `netlify/functions/axis-intent.mjs` (`POST /api/axis/intent`, `verifyAperture`, append to `axis-inbox`) · **patch** `axis-director.js`, `aria-mesh-events.mjs`, `aria-mesh-task-queue.mjs`, `aperture-email-report.js` (add auth) · **new** `scripts/lib/axis-db.mjs` (SQLite schema §8 of the prompt + migrations) · **new** `scripts/lib/axis-snapshots.mjs` (compute + push snapshots) · `assets/axis-roster.json` (+3 agents) · shared constants files.
**Gate:** authed shell loads a real (seeded) snapshot; unauthenticated `/api/axis/*` and the 4 patched endpoints return 401; `check-public-route-hygiene.mjs` green; no secrets in bundle.

### P2 — Shell + parity screens
`assets/axis-tokens.css` · `assets/axis-app.js` (shell, hash router, poll loop, optimistic-intent helper, toast, ⌘K) · per-module render fns for **S1/S2/S3/S14** · AXIS dock wired to `axis-director` (now authed) · orbital-A SVG · migrate old-console sections into v2 homes (read-only bindings). Old consoles untouched.
**Gate:** parity walkthrough; Playwright 1440/768/390 screenshots reviewed by me; badge law + side-effect law demonstrably enforced in code (not just visuals).

### P3 — Sales engine
`scripts/cartographer-agent.mjs` + installer · S4 Pipeline (kanban + table, drag→`stage_override`, auto-transitions) · S5 Prospect Profile · S6 Prospect DB · provenance rendering (`{value,source,confidence,last_verified}` / "Not found — never guessed").
**Gate:** 25 real Toronto SMBs researched end-to-end with full provenance (public-ToS sources only).

### P4 — Outreach + Approvals live
S7 Outreach Studio (3 subjects, email, FU 1–3, LinkedIn, call script, VM, CRM note) + lint pass (banned filler, ≥1 sourced fact, problem-first) · outbound queue + rails **at send time** · Gmail OAuth (drafts-then-send) + Resend fallback · CASL footer + `consent_basis` + suppression check pre-send.
**Gate:** Ahmad approves and sends **one real batch of ≤5**.

### P5 — Sentry live
`scripts/sentry-agent.mjs` + installer · Gmail poll 2–5 min · deterministic+conservative classifier (`reply_to_outreach`/`new_inbound_request`/`bounce`/`ooo`/`unsubscribe`/`noise`; uncertain→actionable) · badge (Law 2) · thread view + 8 actions · side effects (Law 4) · unsubscribe→suppress, bounce→invalidate+pause · Telegram badge-rise push.
**Gate:** live test — a reply produces badge "1", click-through opens that exact email, actions work, badge clears same tick.

### P6 — Follow-ups + Documents
Follow-up engine (day 3/7/14, max 3, auto-cancel on reply, queued through Approvals) · 16 seeded Ontario DRAFT templates ("DRAFT — not legal advice") · append-only versioning · `{{merge_fields}}` · prepare-for-client → Approvals · served only via authed function from a non-public path.
**Gate:** one document prepared for a prospect through Approvals.

### P7 — Analytics + Reports
3 dashboards (worker-computed, Chart.js) + geo heat map + Generated→Won funnel + PNG/CSV/PDF · Excel workbook (`exceljs`, 11 sheets, native charts) · CSV + PDF summary · authed download endpoints · 6-series palette tokens.
**Gate:** every dashboard number reconciles exactly against SQLite.

### P8 — Products + polish + ship
`scripts/miner-agent.mjs` + installer · S11 Product Discovery (5-axis scoring + weighted rank + evidence → AXIS review) · old-console redirects at parity · keyboard/a11y/mobile sweep · empty states · full regression (route hygiene, smoke, screenshot sweep, secrets scan) · runbook `docs/AXIS-CC-V2.md` + updated `CLAUDE.md` reading list · split `.well-known/axis/status.json` public/authed.
**Gate:** Definition of Done (`FORGE-FINAL-BUILD-PROMPT §11`); **production deploy on Ahmad's explicit go only.**

---

## 5. Integration setup (runbook stubs — full steps in `docs/AXIS-CC-V2.md` at P8)

| Integration | Status today | v2 action |
|---|---|---|
| Gmail API | none | Google Cloud project → enable Gmail API → OAuth desktop client → one-time local auth → tokens in `data/secrets/` (git-ignored). **P4.** |
| Apollo | **no code/env** — MCP connector only | Drive via MCP connector for Cartographer/CRM; if server-side needed, `APOLLO_API_KEY` (ask first). **P3.** |
| Resend | working (`RESEND_API_KEY`,`RESEND_FROM`) | reuse as transactional fallback. |
| Telegram | working (`TELEGRAM_BOT_TOKEN`,`_OWNER_CHAT_ID`,`_WEBHOOK_SECRET`) | extend with badge-rise + approval-threshold pushes. **P5.** |
| Stripe | working (live) | read-only MRR for Overview/Analytics. **P7.** |
| M365 Graph | code complete (`M365_TENANT_ID/CLIENT_ID/CLIENT_SECRET`); env unverified | optional calendar for book_meeting; health-check action = probe. **P6+.** |
| Netlify Blobs | working | add `snapshot:*` + reuse `axis-inbox`. **P1.** |

New env vars get one table in the runbook (name · local `.env` vs Netlify env · reader). Gmail/SQLite secrets = **local only**.

---

## 6. What we will NOT do (guardrails restated)

No framework/bundler for the page · no SQLite or secrets in functions/env/Blobs · no prospect data on unauthenticated routes · no send without approval (rails at send time) · no invented facts · no real names in `aria-vault/` (Lead-NNN only) · never touch `Private pics and Vids/` · no Raymond James · no new paid service without asking · **no production deploy without Ahmad's go** · never delete working functionality without listing it as duplicated/obsolete here first · never `git add -A` (dirty tree) · no visible control left non-functional.

## 7. First actions on approval (P1 kickoff)
1. Add `data/`, `data/secrets/`, ps1-negation to `.gitignore`; add `PENDING-DEPLOY-LEDGER.md` row.
2. Shared constants + SQLite schema (`axis-db.mjs`) + snapshot lib.
3. `axis-snapshot.mjs` + `axis-intent.mjs` (authed); patch the 4 open endpoints.
4. `netlify.toml` route-gate + 404-force `data/`.
5. Roster +3 agents. Seed fictional data. Verify gate.
