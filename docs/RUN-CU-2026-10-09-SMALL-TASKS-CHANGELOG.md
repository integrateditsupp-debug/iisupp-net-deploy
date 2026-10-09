# RUN-CU small-tasks close-out — 2026-10-09

Seven small, safe code tasks that agents had asked for repeatedly (some for 10+ weeks) and that never got
done. Branch `cc/run-cu-2026-10-08`, **left in the working tree, not committed** (commits and pushes are
Ahmad's). Rules applied: 14 (real-or-empty), 15 (additive only), 17 (value first). Untouched by design:
`aria.html`, `netlify/functions/aria-chat.js`, `ARIA Sentinel/src/**`, everything under `senior-director-state/`.

## Baseline before any change (measured on this clone, 2026-10-09)

| Suite | Result |
|---|---|
| `node scripts/run-tests.mjs --all` | `all: 136/136 suites passed` |
| `cd "ARIA Sentinel" && node tests/run-all.mjs` | `402 of 402 suites taken — all green` · `# tests 1157 · # pass 1100 · # fail 0 · # skipped 57` |

The four "environment-only" reds listed in `docs/AGENT-BOOTSTRAP.md` §5 did not reproduce here; the baseline was fully green.

## Result after all seven tasks

| Suite | Result |
|---|---|
| `node scripts/run-tests.mjs --all` | **`all: 141/141 suites passed`** (+5 new suites) |
| `cd "ARIA Sentinel" && node tests/run-all.mjs` | **`407 of 407 suites taken — all green`** · `# tests 1177 · # pass 1120 · # fail 0 · # skipped 57` · no `SUITE RED` line |
| `node scripts/check-disclaimer-coverage.mjs` | `ok: true · publicPagesChecked 119 · contextualNotices 14` (was 118 / 13) |
| `node --check` | every touched `.js` / `.cjs` / `.mjs` clean; `docs/openapi.json` and `sitemap.xml` parse |

Harness rules honoured: every new `tests/*.test.mjs` is registered by hand in `ARIA Sentinel/tests/run-all.mjs`
(`TESTS`, dated comment); `tests/suite-registry-census.test.mjs` 20/20; none of the new suites names the
operator record root, so `record-dependencies.json` is unchanged and `record-dependency-declared` stays 6/6.

---

## Task 1 — `/health` rewrite

**Why.** The ARIA morning agent and the uptime checks probe `https://iisupp.net/health`; the function only
existed at `/.netlify/functions/health` and the short path answered 404, so the agent has reported DEGRADED off
the wrong path (reported since 2026-07-28).

| File | Change |
|---|---|
| `netlify.toml` | New `[[redirects]] from = "/health" to = "/.netlify/functions/health" status = 200` (a rewrite, no `force`), placed directly after the `/sentinel-binaries/*` rewrite and **above** the force-404 block, with a comment. `/health-check` (lead-magnet page) is a different exact-match rule and is untouched. |
| `tests/netlify-health-redirect.test.mjs` (new) | Parses `netlify.toml` as text; asserts exactly one `/health` rule, a 200 rewrite to the function, not forced; that it sits above the first 404 rule (Netlify takes the first match); that `/health-check` still maps to its page; and that `netlify/functions/health.js` answers 200 JSON `{status:"ok", service:"ARIA"}`. 4/4. |

## Task 2 — GET read path on the three capture endpoints

**Why.** "15th consecutive blocked run — all three return 405 POST only; 11 weeks of drafted outbound into a
channel nobody can read from." The three POST-only capture functions that persist to Netlify Blobs with a
`405 POST only` answer to everything else are `aria-lead-capture` (Blobs `aria-leads`, prefix `lead/`),
`aria-health-lead` (Blobs `aria-leads`, prefix `health/`) and `aria-contact-back` (Blobs `aria-bookings`).
(No function named `*-capture` beyond `aria-lead-capture` exists; `marketplace-request.mjs` is a fourth
POST-only Blobs capture and could take the same two-line wiring if wanted — not done, not asked.)

| File | Change |
|---|---|
| `netlify/functions/lib/capture-read.cjs` (new) | The one read path: `handleCaptureGet(request, {storeName, prefix, scope})`. Admin only, **fail-closed** through `lib/admin-gate.cjs` `requireAdminToken` (503 when no token is configured, 401 without/with the wrong one, query-string tokens refused, body tokens disabled on GET). Returns `{ ok:true, store, prefix, count, items:[...], newest_first:true, capped, scanned, since, via }`, newest first, **capped at 200** (`?limit` can only lower it), `?since=<iso|epoch-ms>` filter (unparseable → 400 `bad_since`). No CORS wildcard and `Cache-Control: no-store` on this path. Store walk bounded at 2000 keys. Blobs unavailable → 503, never an empty 200. Process-local rate limit 60/min per IP. Works for legacy `event` handlers and Fetch `Request` handlers. Test seam `_setStoreFactory` (same pattern as `lib/sentinel-approvals.cjs`). |
| `netlify/functions/aria-lead-capture.js` | One line after the OPTIONS check: `if (event.httpMethod === 'GET') return handleCaptureGet(…'aria-leads', 'lead/'…)`. POST path byte-for-byte unchanged (same headers, same 405 text for other methods). |
| `netlify/functions/aria-health-lead.mjs` | Same, `aria-leads` / `health/`, via `import captureRead from './lib/capture-read.cjs'`. POST unchanged. |
| `netlify/functions/aria-contact-back.mjs` | Same, `aria-bookings`, no prefix. POST unchanged. |
| `docs/openapi.json`, `openapi.yaml` | `get` operations added for the three paths (parameters `since`, `limit`; responses 200/400/401/429/503; `AdminToken` security in the YAML). `scripts/finish100-generate-assets.mjs` now lists the three names in its GET set so a regeneration keeps them. |
| `tests/capture-read-path.test.mjs` (new) | In-memory Blobs store injected through the seam; fetch mocked to throw. 31 checks: fail-closed gate (503 / 401 / wrong token / query-string token refused / Bearer ok / no CORS wildcard), own-prefix isolation on the shared `aria-leads` store, newest-first shape with `key` + ISO `at` + record, `since` (ISO and epoch) and `limit`, the 200 cap over 264 records, Blobs-down → 503, and the POST path untouched (OPTIONS 204 with the public CORS headers, PUT 405 `POST only`, POST validation 400s on all three). |

Existing suites that cover these functions re-run green: `tests/function-gates.test.mjs` 81/81, `tests/user-data-purge.test.mjs` 30/30.

## Task 3 — `about.html`: meta description and `<h2>`

| File | Change |
|---|---|
| `about.html` | `<meta name="description">` (and matching `og:description`) built only from the page's own copy: founded May 2023, Ahmad W., 15+ years, RBC / Scotiabank / Ontario Health / City of Toronto / IBM / Cavalluzzo LLP, Six Sigma and ITIL — no new claims. The four section titles (`#about-biography`, `#about-certifications`, `#about-track`, `#about-personal`) promoted from `<h3>` to `<h2>`; ids and copy unchanged. The `.about-bio h3` rules now read `.about-bio h2, .about-bio h3` (old selector kept, h2 added alongside) so nothing changes visually. The CTA `<h3>` stays an h3 beneath them. |

Verified with the existing `first-screen-audit` 17/17, `surface-class` 11/11 (its Rule-15 string guard for about.html passes), `cross-surface-consistency` 26/26, `site-fineprint-gate` green; guarded going forward by `tests/site-page-metadata.test.mjs`.

## Task 4 — `areaServed` (79 days open)

| File | Change |
|---|---|
| `docs/listing-copy-pack.md` | New **§10 Service area** — a four-line list (`Greater Toronto Area`, `Durham Region`, `Ontario`, `Canada`) consolidated verbatim from wording the pack already carried in §3, §5 and §9, with the explicit note that the United States is not a service area ("Accepts USD" is a payment term). Header "Last updated" bumped to 2026-10-09 with §1–§9 noted unchanged. |
| `index.html`, `services.html` | JSON-LD `"areaServed": ["Canada", "United States"]` → the four typed entries (`AdministrativeArea` GTA, `AdministrativeArea` Durham Region, `State` Ontario, `Country` Canada). File tails verified intact after the write. |
| `about.html` | Its two-entry list (`Greater Toronto Area`, `Ontario, Canada`) → the same four entries, so all three schemas agree with the pack. |
| `tests/site-page-metadata.test.mjs` (new, shared with tasks 3 and 6) | Reads the pack's §10 fenced list and asserts every `areaServed` on the three pages equals it exactly (typed entries), that the list never names the United States, and that no page still lists the US under `areaServed`. |

## Task 5 — `windows-10-esu-oct-13-check.html` (new page)

**Sourcing.** Every date and price on the page is quoted from a Microsoft page fetched on 2026-10-09 and linked
beside the fact. Where Microsoft does not print a figure the page says so and sends the reader to Microsoft.

| Source URL | Facts taken |
|---|---|
| https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro | Windows 10 end of support October 14, 2025; 22H2 final version |
| https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates | Organization ESU **$61 USD per device for Year One**; "the price doubles every consecutive year, for a maximum of three years"; cumulative (buying in Year Two means paying Year One); 22H2 required; what ESU does/doesn't include; "Windows 10 PCs will continue to work"; no-cost ESU on Windows 365 / Azure VMs |
| https://learn.microsoft.com/en-us/lifecycle/faq/extended-security-updates | Windows 10 ESU year ends: **October 13, 2026 / October 12, 2027 / October 10, 2028**; eligible editions "Enterprise, Education, and Pro in Commercial use"; Windows Server 2012/R2 extended support ended October 10, 2023, ESU Year 3 ends October 13, 2026 |
| https://www.microsoft.com/windows/extended-security-updates | Consumer ESU: enroll "any time until the program ends on **October 12, 2027**"; options — no additional cost with settings sync, 1,000 Rewards points, **one-time $30 USD**; up to 10 devices; Microsoft account required; "can't be used in commercial scenarios", not offered to domain-/Entra-joined or MDM-enrolled devices (Entra-registered may) |
| https://learn.microsoft.com/en-us/lifecycle/products/office-2021 | Office 2021 retirement `10/14/2026 6:59:59 AM` Pacific (= end of October 13, 2026); editions listed; no ESU on the page |
| https://learn.microsoft.com/en-us/lifecycle/products/office-ltsc-2021 | Office LTSC 2021 mainstream end `10/14/2026 6:59:59 AM` Pacific; no ESU on the page |
| https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2012 | Extended end `10/11/2023 6:59:59 AM` Pacific; ESU Year 3 `10/15/2025 8:00:00 AM – 10/14/2026 6:59:59 AM` Pacific |
| https://learn.microsoft.com/en-us/microsoft-365-apps/end-of-support/windows-10-support | Microsoft 365 Apps on Windows 10: security updates until October 10, 2028; feature updates until Version 2608; reduced-support stance quoted |

**Premise correction (Rule 14).** The brief said "consumer/commercial ESU price steps up" on 2026-10-13. Microsoft's
consumer page as fetched now says the consumer programme runs to **October 12, 2027** with the same three
enrollment options; the page states that, dated, rather than the brief's wording. The October 13, 2026 cliff is real
for **organization** ESU (Year 1 end, Year 2 purchase, "price doubles"), Office 2021 / LTSC 2021 and Windows Server
2012/R2 ESU Year 3. The Year-Two dollar figure is deliberately **not** printed (Microsoft doesn't print it); the page
says "check Microsoft's page". Two lines of unverifiable copy were removed before publish ("no local company has
published this", "the consumer end date has already moved once").

| File | Change |
|---|---|
| `windows-10-esu-oct-13-check.html` (new) | XO elite theme head pattern copied from `switching-it-provider-checklist.html` (fonts link, `/assets/xo-elite-theme.css`, fine-print head block), canonical + OG, FAQPage JSON-LD (5 Q&As, all sourced). Five fact cards with verbatim Microsoft quotes and links; a 6-question self-check (plain JS, no server, no storage, arithmetic on the six answers only; green / amber / red band; one ordered finding per scored answer); "What to do this week" (7 plain steps); FAQ; a visible Sources list with all eight URLs and the fetch date; Related links; CTA `/book.html` + `(647) 581-3182` (copy pack §1); honesty note; `data-last-verified="2026-10-09"` (the day the content was verified against Microsoft's pages) with the shared stamp script. Tag balance checked. |
| `scripts/inject-riskbar.mjs` | New `tool` target for the page (anchor: the privacy pill). `node scripts/inject-riskbar.mjs` run → risk notice injected (14 contextual notices, was 13). |
| `node scripts/inject-disclaimer.mjs` | Run → fine print head + body injected on the new page only (`added: 1, updated: 0, unchanged: 118`). |
| `sitemap.xml` | Entry added (`lastmod 2026-10-09`, monthly, 0.7) beside its siblings. |
| `switching-it-provider-checklist.html`, `managed-it-cost-toronto.html` | Additive "Related" block before each page's disclaimer linking the new page (plus the sibling tools). |
| `tests/windows-10-esu-check-page.test.mjs` (new) | The eight sources are linked and no non-Microsoft external link exists; every `$` figure is in the cited set {61, 30} and `$122`/`$244` never appear; every "October d, yyyy" on the page is one of the five cited dates; fine print + riskbar + theme head + CTA + sitemap + sibling links present; the checker makes no network call; and the checker is **executed** against a DOM shim: six questions, every scored option carries a finding, all-clear → `0 / max` green, worst case → red with six findings and no invented percentage. 5/5. |

`customer-link-graph` 16/16, `first-screen-audit` 17/17, `surface-class` 11/11, `site-fineprint-gate` (ARIA Sentinel) green.
Note: the fineprint gate counts **tracked** HTML, so it will count the new page once committed (it already carries the strip; `check-disclaimer-coverage` sees it today: 119 pages ok).

## Task 6 — "Last verified" freshness on the three answer pages

**Why.** Flagged 3× over 8 weeks: the stamp was a hand-typed "Last reviewed 2026-07-14" on two pages and absent on the third.

Real last-commit dates (`git log -1 --format=%cs -- <file>`): all three = **2026-10-08** (commit `fa88d34`, the merge
that added the fine-print lines). That is the value used; it is **not** today's date. Honesty caveat for Ahmad: the
commit date is "page last changed", not "facts re-checked by a human" — the original "Last reviewed 2026-07-14" line is
kept beside the new stamp (Rule 15) so both facts stay visible; when the content is genuinely re-verified, set the
attribute by hand.

| File | Change |
|---|---|
| `managed-it-cost-toronto.html` | Had no freshness line at all: `.fresh` rule added; `<span class="last-verified" data-last-verified="2026-10-08">Last verified 2026-10-08</span>` added to the disclaimer; the shared stamp script inserted before the page's own script. |
| `switching-it-provider-checklist.html`, `copilot-oversharing-check.html` | Same stamp appended inside the existing `.fresh` span after "Last reviewed 2026-07-14"; same script. |
| (shared inline script, byte-identical on all three pages, carries no date of its own) | Reads `[data-last-verified]`, renders `Last verified YYYY-MM-DD (n days ago)`; an invalid or future value is left exactly as written so a defect stays visible. |
| `tests/site-page-metadata.test.mjs` | Each page has exactly one attribute; it is `YYYY-MM-DD`, a real calendar date, **not in the future**, not older than the hand-typed date it replaced; the no-JS text carries the same date; the script is identical on all three pages; and the script is executed in a DOM shim: a 9-day-old date renders "(9 days ago)", a future date and junk are left untouched. |

## Task 7 — `loops/agents/*.yaml` swapped bodies

**Why.** In all 27 files the bodies of `kpis:` and `tools_allowed:` were swapped since first commit (2026-06-25): the tool
allow-list read as a KPI sentence, the KPI block carried the tool list — with an indent that made **every file fail to
parse as YAML** (`expected <block end>, but found '<block sequence start>'`).

| File | Change |
|---|---|
| `loops/agents/*.yaml` (27 files, 81 lines each way) | Bodies swapped back: `kpis: |` now carries the KPI prose (2-space indent), `tools_allowed:` carries the `- tool` list. Every key kept, key order unchanged, nothing else touched (trailing newline state preserved). All 27 now parse (checked with PyYAML and js-yaml). **No loop was wired live.** |
| `tests/loops-agents-yaml-shape.test.mjs` (new) | Line-based (the root package has no YAML parser): 27 files; every required key present and `kpis` before `tools_allowed`; `kpis` is a literal block of prose with no list items; `tools_allowed` is a list whose every entry starts with a tool identifier (`filesystem.write (…)`, `loops-cli (…)`, `fetch`, …) and carries no `·` prose; the exact swapped shape as a fixture is recognised; and, when `ARIA Sentinel/node_modules/js-yaml` is reachable (it is here), every file is parsed and cross-checked (`kpis` string, `tools_allowed` string[]). 4/4. |

## Registration

`ARIA Sentinel/tests/run-all.mjs` `TESTS` — five entries added by hand with a dated comment:
`../../tests/netlify-health-redirect.test.mjs`, `../../tests/capture-read-path.test.mjs`,
`../../tests/site-page-metadata.test.mjs`, `../../tests/windows-10-esu-check-page.test.mjs`,
`../../tests/loops-agents-yaml-shape.test.mjs`.

`docs/AGENT-BOOTSTRAP.md` — §5 gained the 2026-10-09 measured line; §6 gained a row pointing here. Nothing removed.

## Not done / for Ahmad

- Nothing was committed or pushed; nothing was published. The working tree also still carries the three pre-existing
  uncommitted edits from the earlier CU close (`ARIA Sentinel/docs/RELEASE_NOTES_0.2.0.md`, the earlier part of
  `ARIA Sentinel/tests/run-all.mjs`, `tests/ceo-approval-items-override.test.mjs`) — untouched here.
- The GET read path needs `ARIA_ADMIN_TOKEN` (or `SENTINEL_ADMIN_TOKEN` / `INTERNAL_WEBHOOK_SECRET`) set on Netlify
  to answer anything other than 503; that is by design (fail-closed).
- The Microsoft page is a snapshot of 2026-10-09; Microsoft's pages win if they change. Re-fetch before October.
- `marketplace-request.mjs` could take the same GET wiring in two lines if the agents want it.
- No headless browser was available on this clone, so the new page was verified by tag-balance + the DOM-shim test, not
  by a real render.

_For this task I did not need to read obsidian romean._
