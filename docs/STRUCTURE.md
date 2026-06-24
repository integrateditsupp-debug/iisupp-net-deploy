# Repository Structure — Operational Map

> One repo, four business lines. This map exists so any agent (or Ahmad) can find the right place in 5 seconds
> and so we stop "falling behind." Authored on the `cc/master-run-2026-06-23` review branch off current
> `origin/main`. **No files were moved** — moving customer paths risks breaking Netlify deploys, internal links,
> and `netlify.toml` redirects (R6/R8). Where consolidation is unsafe, it is documented here instead.

## The four business lines (per `aria-vault/07_Cortex/Ahmad.md`)

1. **IIS** — the managed-IT services company + public website (iisupp.net).
2. **ARIA** — the AI assistant SaaS at `/aria`.
3. **ARIA Sentinel** — the Windows desktop agent.
4. **AXIS** — the voice layer (early; lives inside the Sentinel tree).

> **ARIA web + ARIA Sentinel are ONE product, ONE brain** (decision [[D-20260624-aria-web-sentinel-one-product]]).
> The cloud surface (`/aria`) and the desktop surface (Sentinel) share the same KB
> (`knowledge-base/` + `aria_brain_pack/`), recipes, stop-codes, and the locked answer chain (KB $0 →
> Anthropic → offline local KB), and the **same agents build both**. The only intentional difference:
> the web "Resolve it for me" routes to a **download-Sentinel-or-continue-walkthrough** gate (it never
> runs a local fix), while Sentinel resolves **locally** through the RUN 29 gated control plane
> (supervisor → 10s countdown → Ctrl+Alt+K kill-switch; Confirmed-grade, never autonomous).

## Branch model (the "falling behind" root cause + fix)

- **`origin/main` = the website deploy branch.** Netlify auto-deploys it. It carries the public site + the
  ARIA web brain + customer-facing KB/compliance content.
- **The full ARIA Sentinel desktop app is NOT on `main`** — `main` only carries a small deploy-time subset of
  `ARIA Sentinel/` (9 files: the web-relevant routing in `assets/`, a couple of renderer files, package.json,
  release notes), brought in by occasional `[deploy] RUN NN source files` commits. The **full 150-file desktop
  app** (src/main, admin-console, the ~184-suite test harness, axis/) is developed on the **`sprint-0-backend`
  dev branch** and is preserved there (latest snapshot: WIP commit `8e72dca`, 2026-06-23).
- **Root cause of "missing commits":** the local clone had drifted **172 commits behind `origin/main`**, and
  work was committed to side branches (`sprint-0-backend`, `kb-bulk-push`) that were never reconciled. This
  created the *illusion* of lost work. On audit, the genuinely-additive content (27 KB articles, 11 AEGIS
  governance policies) was **already on `origin/main`** — nothing was actually lost. See
  `aria-vault/07_Cortex/lesson-stay-synced-to-origin-main.md`.
- **Going forward:** branch off **current** `origin/main`, push **review branches**, merge promptly. Never
  build on the stale local `main`.

## Top-level map by business line

### IIS — public website (the deploy surface)
- **Entry / marketing pages (root `*.html`):** `index.html` (home), `services.html`, `product.html`,
  `enterprise.html`, `government.html`, `about.html`, `book.html`, `refer.html`, `health-check.html`,
  `purchase-tech.html`, `start-here.html`, `m.html` (mobile entry).
- **Commerce:** `shop.html`, `marketplace.html`, `plans/`, `growth-library.html`, `downloads/`,
  `procurement-downloads/`, `checkout-success.html`, `unlock.html`, `purchase-tech.html`.
- **Comparators / proof:** `compare/`, `sample-scenarios/`, `verticals/`, `case-study-templates/`.
- **Static + runtime:** `assets/` (JS/CSS/data), `images/`, `icons/`, `public/`, `favicon.svg`,
  `manifest.webmanifest`, `service-worker.js` + `sw.js`, `offline.html`.
- **Backend:** `netlify/functions/` (customer + ops functions), `netlify/edge-functions/` (if present),
  `netlify.toml` (redirects/headers — **do not break**), `.netlifyignore`.
- **Legal / compliance / trust (customer-facing):** `governance/`, `compliance/`, `terms/`, `legal/`,
  `security/` + `security.html`, `trust/`, plus readiness pages (`soc2-readiness.html`,
  `soc2-evidence-inventory.html`, `iso-27001-readiness.html`, `pipeda-readiness.html`, `ipv6-readiness/`,
  `platform-readiness.html`, `compliance-gap.html`, `ethics-grievance.html`).

### ARIA — the AI assistant SaaS
- **Widget / pages:** `aria.html`, `aria-cinema.html`, `aria-data-export.html`.
- **Brain runtime:** `aria-brain.js`, `aria-transform.js`, `aria-mesh-client.js`, `aria-architecture/`,
  `assets/aria-kb-retrieval.mjs` (live routing the `aria-kb-query` function bundles), `assets/aria-kb-*.json`
  (bundles), `assets/aria-*.js`.
- **Knowledge base (customer-facing articles):** `knowledge-base/` (253 files: `bleeding-edge/`, `internet/`,
  `legacy/`, `top50-gaps/`, `vpn/`, tiered articles, `_meta/manifest.json`).
- **Learning data:** `aria_brain_pack/` (563 files — ARIA's learned "bits"/kb pack; distinct from the vault).
- **Backend:** `netlify/functions/aria-*` (chat, kb-query, learn, feedback, lead-capture, …).

### Aperture — observability + learning dashboards
- `aperture.html`, `aperture-learning.html`, `aperture-mesh-web.html`, `aperture-office-view.html`,
  `mesh-registry.json` (+ `aria-mesh-client.js`). Login-gated; **must keep loading after every deploy (R8)**.

### ARIA Sentinel — Windows desktop agent
- **On `main`:** `ARIA Sentinel/` = deploy subset only (see Branch model above).
- **Full app:** the `sprint-0-backend` dev branch (`src/main`, `src/renderer`, `admin-console/`, `tests/`,
  `axis/`, `dist/`). Build/test/release happen there; customer build excludes admin-console/tests/docs/axis.
- **Backend:** `netlify/functions/sentinel-*` (heartbeat, license register/search, OTA update manifest/publish,
  stripe-webhook, resolve).

### AXIS — voice layer
- Lives under the Sentinel tree (`ARIA Sentinel/axis/`, dev branch) — Phase-1 scaffold/stubs. Not a top-level
  `main` concern yet.

### Internal ops / agent mesh (not customer-facing)
- **Institutional memory:** `aria-vault/` (125 files — the Obsidian vault: RULES, Cortex, feedback, daily,
  CorpusCallosum log). The **durable** memory (R13). Distinct from `aria_brain_pack` (ARIA's KB learning) and
  `knowledge-base` (customer articles).
- **Director / packets:** `senior-director-state/` (Cowork state, RUN packets, queues, loop board).
- **Automation:** `loops/` (Loops OS spec/registry), `scripts/`, `tools/` (e.g. `iis-tester-agent.mjs`),
  `tests/`, `src/`, `sdk/`, `apps/`.
- **Internal dashboards (`*.html`):** `command-center.html`, `agent-command-center.html`,
  `ceo-action-console.html`, `growth-command-center.html`, `opportunity-engine.html`, `lead-radar.html`,
  `leads-admin.html`, `revenue-dashboard.html`, `cost-dashboard.html`, `cost-calculator.html`,
  `analytics.html`, `usage.html`, `status.html`/`status-history.html`, `tenant-admin.html`,
  `white-label-admin.html`, `write-gate-history.html`.
- **Artifacts:** `backups/`, `archive/`, `outputs/`, `docs/`.

## Documented overlaps (left in place by design — do not blind-merge)

| Cluster | Dirs | Distinction (why kept separate) |
|---|---|---|
| Governance vs compliance | `governance/` (13 — the 11 AEGIS policy HTML pages + index) · `compliance/` (19 — the compliance hub + framework sub-pages) | Different audiences/routes; both linked from the site. A merge would break `/governance/*` and `/compliance/*` routes. Keep separate; cross-link only. |
| ARIA knowledge stores | `knowledge-base/` (253, customer KB articles) · `aria_brain_pack/` (563, ARIA's learned bits/pack) · `aria-vault/` (125, internal Obsidian memory) | Three different consumers: the `/aria` widget, the learning loop, and the agent mesh. Same word "knowledge," three different jobs. Never merge — they have different privacy + render rules (vault is R11-name-scrubbed; KB is public). |
| `Project AEGIS - Governance`, `aria_memory` | (absent on `main`) | Existed only in the dev/working tree; the real governance content is `governance/` + `downloads/governance/*.docx`. No action on `main`. |

## Protected — never move (deploy/link integrity)
`index.html`, all root `*.html` pages, `netlify/`, `assets/`, `knowledge-base/`, `aria-vault/`, anything
referenced by `netlify.toml`, and (R11) the off-limits `Private pics and Vids` folder on Ahmad's machine.
