// site-fineprint-gate.test.mjs — the site-wide legal disclaimer strip may never silently disappear.
//
// WHY THIS EXISTS (2026-08-04, found first-hand, not theorised):
//   The site-wide legal fine print landed on the shared line as commit bca99eef. A long-lived feed
//   branch carrying six cycles of work had been cut BEFORE that commit. Diffing the branch against
//   the shared line showed exactly -10 lines on 94 public HTML pages: the <link> in <head> and the
//   disclaimer <div> at the end of <body>. Nobody deleted anything — the branch simply predated the
//   commit. But the failure mode was real and one bad merge strategy away: land the branch with its
//   side winning and 94 public pages quietly lose their legal disclaimer, with no test to notice.
//
//   A legal notice that can be removed by a merge nobody reads is not a legal notice. This gate makes
//   that removal loud.
//
// THE RULE:
//   Every tracked public HTML page must carry BOTH fine-print markers — the stylesheet link in <head>
//   and the disclaimer block in <body>. Pages that are legitimately NOT public marketing surface are
//   listed by name below. The exclusion list is EXPLICIT on purpose: a brand-new public page is not on
//   it, so a new page that ships without the disclaimer fails this gate rather than slipping through.
//
// Rule 15: this gate adds a check. It removes nothing and relaxes nothing.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const HEAD_MARKER = "iis-fineprint:head:start";
const BODY_MARKER = "iis-fineprint:start";

// Directories that are not the public website: the desktop app, its extensions and design artefacts,
// dated backups of former pages, dependency and build output.
const EXCLUDED_DIRS = [
  "ARIA Sentinel", "backups", "node_modules", ".git", ".netlify",
  "_branch-src", "_incoming-patches",
  // docs/ is force-404'd by netlify.toml, so nothing under it is ever served. held-releases/ in
  // particular holds parked markup fragments that are deliberately not live pages — this gate found
  // one on its first run and the honest answer was "not public", not "add a disclaimer to it".
  "docs/held-releases",
];

// Operator-internal consoles and non-content pages. These are reachable only behind a login or are
// not marketing surface at all, so the visitor-facing disclaimer does not belong on them.
// Adding a name here is a deliberate decision and shows up in review as one.
const EXCLUDED_PAGES = new Set([
  "admin-console.html", "agent-command-center.html", "ai-bot-index.html", "analytics.html",
  "aperture-office-view.html", "ceo-action-console.html", "checkout-success.html",
  "command-center.html", "cost-dashboard.html", "docs/api.html", "forums-admin.html",
  "growth-command-center.html", "lead-radar.html", "leads-admin.html", "offline.html",
  "pricing-experiments.html", "revenue-dashboard.html",
]);

function walk(dir, rel = "") {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const relPath = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      // Skip excluded trees at ANY depth — the earlier funnel-link-guard bug was a skip list
      // anchored to the repository root, which never skipped nested dependency trees.
      if (EXCLUDED_DIRS.includes(e.name) || EXCLUDED_DIRS.includes(relPath)) continue;
      out.push(...walk(path.join(dir, e.name), relPath));
    } else if (e.isFile() && e.name.endsWith(".html")) {
      out.push(relPath);
    }
  }
  return out;
}

const pages = walk(repoRoot).filter((p) => !EXCLUDED_PAGES.has(p));

assert.ok(
  pages.length >= 100,
  `expected the public page set to be substantial; found ${pages.length}. If this collapsed, the ` +
  `walk is wrong and the gate would pass vacuously.`
);

const missingHead = [];
const missingBody = [];
for (const rel of pages) {
  const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
  if (!src.includes(HEAD_MARKER)) missingHead.push(rel);
  if (!src.includes(BODY_MARKER)) missingBody.push(rel);
}

assert.deepEqual(
  missingBody, [],
  `public pages missing the legal disclaimer block (${missingBody.length}):\n  ` +
  missingBody.join("\n  ") +
  `\n\nEither the page is public and needs the disclaimer, or it is operator-internal and belongs ` +
  `in EXCLUDED_PAGES by name. Silently shipping a public page without it is the one option this ` +
  `gate removes.`
);

assert.deepEqual(
  missingHead, [],
  `public pages missing the fine-print stylesheet link in <head> (${missingHead.length}):\n  ` +
  missingHead.join("\n  ") +
  `\n\nWithout the stylesheet the disclaimer still renders, but unstyled and out of place.`
);

// The disclaimer must actually say the load-bearing things, on a real page — not just carry markers
// around empty content. Checked on a page picked by content, not by position in the list.
const sample = pages.find((p) => p === "index.html") || pages[0];
const sampleSrc = fs.readFileSync(path.join(repoRoot, sample), "utf8");
for (const phrase of ["used at your own risk", "disclaimer.html", "terms.html"]) {
  assert.ok(
    sampleSrc.includes(phrase),
    `the disclaimer block on ${sample} is missing "${phrase}" — markers present but content hollowed out`
  );
}

console.log(
  `site-fineprint-gate passed — ${pages.length} public pages carry the legal disclaimer strip ` +
  `(head + body), ${EXCLUDED_PAGES.size} operator-internal pages excluded by name.`
);
