# Site sweep — iisupp.net, 2026-10-14

Branch `cc/sentinel-prod-2026-10-14`. A headless crawl of every page of the static site (repo root, Netlify `publish = "."`),
the fixes for everything it found that was broken, and the items left in place with the reason for each.
(This folder is force-404 on the live site, so this file is internal.)

| | before | after |
|---|---|---|
| Tree crawled | `31672d44` (site files as committed before the sweep) | `6193ff84` (after the four commits below) |
| Unique served HTML pages (+ query-state URLs) | 130 (+ 3) | 130 (+ 3) |
| Visits: every page at 1366×768 desktop and 390×844 phone | 266 | 266 |
| **Defects** | **43** | **9 — every one documented below as intentional / out of this lane** |
| Root suites (`node scripts/run-tests.mjs`) | guard 14/14 · `--all` 157/157 | guard 15/15 · `--all` 158/158 |

Commits: `fbea15d6` SITE SWEEP (1/4) — the fixes · `a5a12aab` DOWNLOADS (2/4) — simulation + savings estimate ·
`6193ff84` DOWNLOADS (3/4) — release block + guard suite · this report (4/4). The crawl of `fbea15d6` alone also reads
**9** — the /downloads/ additions did not add a defect.

## How the crawl works

`crawl.mjs` (Playwright 1.56 + the preinstalled Chromium in `/opt/pw-browsers`, no `playwright install`) starts a local
server on the repo root that behaves like Netlify for this site, then visits `/`, every internal link it discovers (same
origin, `https://iisupp.net/...` counted as internal, cap 400) and every page in the inventory
(`git ls-files '*.html'` minus `ARIA Sentinel/` and `node_modules`: 141 files, 129 served at their own URL, 12 redirected or
blocked by design — see below; of those 12, webinar.html is still reached at `/webinar` through a link on insiders.html,
which makes 130 unique pages), plus three query-state URLs of the
sell pages (`/downloads/?checkout=success&session_id=…`, `/downloads/?checkout=cancel`, `/plans/?checkout=canceled`),
each at 1366×768 and at 390×844 (phone emulation:
`isMobile`, touch, DPR 3, Android Chrome UA — so a page's viewport meta is honoured the way a phone honours it).

The server replays all 301 `[[redirects]]` rules of `netlify.toml` in order (first match wins; `from`/`to`, `:splat`,
200 rewrites, 301/302, force-404, `force`, trailing-slash normalisation, shadowing: a non-forced rule loses to an existing
file), pretty URLs (`/x` → `x.html`, `/x/` → `x/index.html`, `/dir` → 301 `/dir/`), `/.well-known/`, the branded
`404.html`, and the `mobile-detect` edge function (`/` and `/index.html` → `m.html` for a phone; the phone pass of
`index.html` uses the page's own `?desktop=1` bypass, `m.html` is crawled on its own). Serverless endpoints
(`/.netlify/functions/*`, the v2 `/api/*` paths declared in `netlify/functions`) are not run: they answer 503 and the
crawl checks statically that the function exists. No network: external requests are aborted and only counted, with
one exception — `cdn.tailwindcss.com` is answered from a local copy of the same Play CDN runtime (v3.4.17, vendored in
`@zenuml/core`), because without it every Tailwind page loses its preflight and the layout checks would be wrong.

Per page and viewport it records: navigation status · sub-resources that failed (4xx/5xx/aborted; a cancelled request for a
file that *is* served, a HEAD probe and media range requests are not failures) · console errors and uncaught exceptions
(minus the ones the offline setup itself causes: blocked external files, function stubs, `<cdn global> is not defined`) ·
in-page `#anchors` with no target · cross-page `page#id` links whose id is missing on the target · `<img>` with
`naturalWidth 0` · internal links that resolve to 404 (followed through the rules) · Netlify form consistency (a
`data-netlify` form without a name, a hidden `form-name` that disagrees with the name, a missing honeypot field, a form
that only exists in the runtime DOM, a `form-name` posted by script that no static form registers) · duplicate ids ·
sideways overflow (the page can be panned, or the phone has to zoom out because content is wider than the layout the page
asked for) · missing `<title>` · mojibake (double-decoded UTF-8) in the title, meta description or visible text.
Static checks: every `sw.js` precache entry resolves; every function a page calls exists.

### Re-run

```bash
cd /home/claude/sentinel
# after (the working tree)
node /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/site-sweep/crawl.mjs --root /home/claude/sentinel --label after
# before (any commit, from a clean extract; the crawler walks the folder when it is not a git checkout)
mkdir -p /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/site-sweep/before-tree
git archive 31672d44 -- . ':(exclude)ARIA Sentinel' ':(exclude)public/sentinel-binaries' | tar -x -C /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/site-sweep/before-tree
node /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/site-sweep/crawl.mjs --root /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/site-sweep/before-tree --label before
# /downloads/ screenshots (simulation mid-play, savings estimate, release block, + one TESTDATA shot of the download state)
node /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/site-sweep/crawl.mjs --root /home/claude/sentinel --shots /tmp/claude-0/-home-claude/8a0e56d5-6858-5d12-9f45-4f6c8e8b2b08/scratchpad/shots-site
```

Output: `site-sweep/out/crawl-<label>.json` (every record) and `crawl-<label>-summary.txt` (counts, defect list, pages not
served as themselves). Options: `--only /a/,/b.html` · `--max 400` · `--workers 4`. About 3½ minutes for the whole site.
The crawler lives in the session scratchpad (`scripts/` other than `run-tests.mjs` is outside this lane); copy it to
`scripts/site-sweep-crawl.mjs` to keep it.

## Defects found and fixed (34 of 43, commit `fbea15d6`)

| Page(s) | Type | Detail | Fix |
|---|---|---|---|
| index, about, copyright, disclaimer, extension, m, purchase-tech, services, terms, trust, trust/index + `assets/aria-core.js` (12 entries) | form-netlify-js-only / form-post-unregistered | The "Get IT Support" modal (`showGIS`, opened by the chat button) posts `form-name=get-it-support` to `/`, but that form only ever existed in the runtime DOM (`injectStaticForm`, since 2f86b73d). Netlify registers forms by parsing the deployed HTML, so those submissions had no form to land in. | `index.html` carries a hidden static `<form name="get-it-support" data-netlify="true" netlify-honeypot="bot-field" hidden>` with the same fields; `id="gisStaticForm"` makes the injector skip its own copy there. |
| aria, plans, plans?checkout=canceled (3) | broken-link | The ARIA Web tier card's fallback "Contact us" → `/contact.html`, which does not exist (shown whenever the Stripe price is not configured or the function is unreachable). | `assets/aria-web-tier.js`: → `mailto:` sales path (the one /plans uses). `web-tier-contract.test.mjs` still green. |
| aria, index (2) | failed-subresource | `https://iisupp.net/aria/v1/manifest.json` → 404 on every load of /aria (and its homepage iframe) and every 5 minutes after; no such file in any commit, no rule. | `aria.html`: `UPDATE_MANIFEST_URL = ''` and `checkForUpdates()` returns when it is empty. The KB/caps swap never ran before either; nothing else changes. |
| aria (3) | duplicate-id | `buildGlobe()` writes `dotGlow`, `trafficArcs`, `trafficPackets`; called twice, so the voice globe duplicated them and its glow pointed at the right-panel globe's filter. | The voice-globe call renames its three ids (`-voice`) and its `url(#dotGlow)` references; the arc/packet scripts only touch `#globeWrap`. |
| compare/aria-vs-vapi, white-label-admin (2) | broken-link | "API docs" / "Review ARIA API" → `/docs/api`, `/docs/api.html` — `/docs/*` is force-404 by design (internal). | → `/?contact=1&subject=ARIA API docs request` ("API docs on request" / "Request ARIA API docs"). |
| ai-bot-index (1) | broken-link | `/openapi.yaml` — force-404 by design. | Row removed from the crawler-facing table (the spec is not published). |
| index (1) | broken-anchor | "See our apps, examples & recent work ↓" → `#introducing-aria`; that section was removed in b3a1439d ("migrate details to ARIA in motion"). | `assets/aria-core.js`: → `#aria-cinematics` ("ARIA in motion"). |
| index (2) | broken-cross-page-anchor | Hero cards → `/services#tier1-operational-foundation`, `/services#website-ai-intake`; neither id has ever existed on services.html. | → `/services#managed-it` (Preventative IT Support) and `/services#web-digital` (Website + AI Assistant Setup). |
| services, shop (2) | broken-anchor / cross-page | "View inventory →" → `/services.html#inventory`; the inventory section is on purchase-tech.html. | `services.html` and `assets/iis-catalog.js` (the shop card) → `/purchase-tech.html#inventory`. |
| forums/index (1, plus 3 script-rendered links) | broken-cross-page-anchor | "Apply to be a verified expert" / "Escalate to IIS" → `/#contact`; the homepage has no such target — its intake opens on `?contact=1`. | `forums/index.html`, `assets/forums.js` → `/?contact=1&subject=…` (works on `m.html` too). |
| sample-scenarios (1) | overflow-x-390 | Two fixed inline grids (`repeat(4,1fr)`, `repeat(3,1fr)`) with Cinzel figures forced a 446 px layout on a 390 px phone. | `repeat(auto-fit,minmax(150px,1fr))` / `repeat(auto-fit,minmax(min(100%,240px),1fr))`: still 4 + 3 columns at 1366 px (measured), 2 + 1 at 390 px. |
| trust, trust/index (4) | mojibake | Double-encoded em dashes ("â€”") in the meta description (search snippets) and the visible copy. | Replaced with "—" (7 occurrences; the files keep their BOM). |

## Remaining (9) — intentional, with the reason

| Page | Type | Detail | Why it stays |
|---|---|---|---|
| aperture, aperture-mesh-web, aperture-office-view (3) | failed-subresource | `/mesh-registry.json` → 404 | `netlify.toml` force-404s it on purpose (internal registry, 2026-07-01 lockdown). Each page catches the failure and renders with an empty agent list. Aperture pages: reported, logic not altered (instruction). |
| aperture-office-view (4) | missing-title · mojibake · overflow-x-1366 · overflow-x-390 | No `<title>`/viewport, "Â·" in the floor-plan header, a 1400 px fixed-width board. | It is an unlinked drop-in fragment for the Aperture command center (its header comment says so), not a page; left untouched as Aperture. The mojibake fix is a one-character replace if the owner wants it. |
| opportunity-engine (1) | failed-subresource | `/senior-director-state/opportunity-engine/opportunities.json` → 404 | Internal state, force-404 by design; the operator page falls back to its built-in `FALLBACK_ITEMS`. |
| downloads?checkout=success (1) | missing-function | `GET /.netlify/functions/sentinel-checkout-status` — no such function | The page's own comment: "requested from the server lane; a 404 simply leaves the generic copy in place". `netlify/functions/` is outside this lane. |

## Listed, not counted

- **Small overflow that depends on web fonts not installed offline (3, unverified):** about.html (395 px on 390:
  `#about-certifications`, `#about-biography` headings in Instrument Serif at the theme's 30.4 px), services.html (393 px:
  "Network & Infrastructure" `h2.svc-cat-title`), opportunity-engine.html (1285 on 1280: "Growth" in Work Sans). Google
  Fonts are not reachable from the crawl, so these were measured in fallback faces; check them on a real phone.
- **Hash-routed anchors (24):** forums/index.html (`/forums/solutions`) uses `#solutions`, `#discussions`, `#askai`,
  `#experts`, `#trends` as routes (`assets/forums.js` listens for `hashchange`) — not broken.
- **Inventory pages not served as themselves (12, by design in netlify.toml):** agent-command-center, analytics,
  ceo-action-console, command-center (301 → /aperture-learning.html → AXIS), aperture-learning (200 → axis.html),
  compare/aria-vs-msp-x (301 → /compare/), webinar (301 → /book), docs/api + docs/held-releases/downloads-available-now
  (`/docs/*` force-404), and the three `backups/pre-surround-…` copies (`/backups/*` force-404).
- **Not checked by design:** 33 unique external links and 474 external sub-resource requests (no network; counted only);
  9 serverless endpoints called by pages (all exist except `sentinel-checkout-status`, above).

## Site-wide observations outside a smallest-change sweep

- **104 pages declare `<meta name="viewport" content="width=1280">`**, so a phone renders the desktop layout scaled to
  about 30 % (prior audit P1 #5). It is a site-wide design decision, not a per-page bug; only `/downloads/` was moved to
  `width=device-width` (it has its own phone breakpoints and the new simulation must be usable on a phone).
- **health-check.html** prices its "ARIA" plan comparison with the old Sentinel list (`599`, `1500`, `156000`, `312000`
  × `USD_CAD`), not `pricing-tiers.mjs`. Pricing was out of scope; flagged for the owner.
- aria.html's globe arcs use `window.__globeCities`, which the second `buildGlobe()` call overwrites with the 420 px
  globe's coordinates, so arcs on the 380 px globe are slightly off. Cosmetic; not changed.

## /downloads/ additions (commits `a5a12aab`, `6193ff84`)

`#sentinel-sim` (scripted simulation, `assets/sentinel-sim.js` + `.css`, banner "Simulation — scripted on this page.
Nothing runs on your computer."), `#sentinel-savings` (estimate from the visitor's inputs; prices from an inline JSON
copied from `pricing-tiers.mjs`), `#get-sentinel` (reads `downloads/sentinel-release.json`, shipped with
`"windows": null`). Guarded by `tests/sentinel-downloads-page.test.mjs` (root guard set). The crawl of the final tree
shows no defect on /downloads/ at either viewport, no sideways overflow at 390 px, and no console error; every branch of
the simulation (nobody answers, Fix now, Not now, Never for this, Cancel, Get help now, pause/resume, arrow-key tabs) was
exercised in Chromium with no page error.
