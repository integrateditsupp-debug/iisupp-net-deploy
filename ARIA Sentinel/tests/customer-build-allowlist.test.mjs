// F4 2026-10-14 (audit M16 / R7 / §4) — THE CUSTOMER BUILD SHIPS ONLY WHAT A CUSTOMER SURFACE REACHES.
//
// `build.files` used to be `src/**/*`, which put 121 unreachable files — the founder's sales pipeline, acquisition
// funnel, outreach templates, server-only plumbing — inside app.asar on every customer machine. The allow-list is now
// an explicit file list derived from the import graph (scripts/customer-build-manifest.mjs). This suite holds it:
//   (a) every file the graph reaches from a customer entry point is covered by build.files;
//   (b) none of the business-ops modules is reachable, and nothing in build.files could admit one;
//   (c) no renderer / overlay source references an excluded module (a `../shared/revenue-board.mjs` import in the UI
//       would make it reachable and ship it — this names the file before that happens);
// plus the parsers that make (a) trustworthy, proven against fixtures that would fail each the wrong way.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ROOT, ENTRY_FILES, ENTRY_HTML_DIRS, ENTRY_DIRS, FIXED_BUILD_FILES, EXCLUDED_BUSINESS_MODULES,
  codeSpecifiers, htmlSpecifiers, cssSpecifiers, globToRegExp, buildFilesCover, computeReachable, diffBuildFiles,
  expectedBuildFiles, rewritePackageBuildFiles
} from "../scripts/customer-build-manifest.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const files = pkg.build.files;
const graph = computeReachable(ROOT);

// ---- the parsers, on fixtures ----------------------------------------------------------------------------------
assert.deepEqual(codeSpecifiers(`import a from "./a.mjs"; import { b } from '../shared/b.mjs'; export * from "./c.mjs";
import "./side.mjs"; const d = await import("../shared/d.mjs"); const r = require("./e.cjs");
const v = createRequire(import.meta.url)("../../package.json").version; import electron from "electron"; import x from "vosk-browser";`).sort(),
  ["../../package.json", "../shared/b.mjs", "../shared/d.mjs", "./a.mjs", "./c.mjs", "./e.cjs", "./side.mjs"].sort(),
  "every relative import/require/dynamic-import form is seen; bare specifiers (electron, vosk-browser) are not");
assert.deepEqual(htmlSpecifiers(`<link rel="stylesheet" href="./sentinel.css"><img src="aria-live-globe.svg"><script type="module" src="./renderer.js"></script>
<a href="https://iisupp.net/plans">x</a><a href="#top">y</a><a href="mailto:a@b.c">z</a><img src="data:image/png;base64,AAAA">`).sort(),
  ["./renderer.js", "./sentinel.css", "aria-live-globe.svg"], "HTML src/href relative refs only (http/#/mailto/data skipped)");
assert.deepEqual(cssSpecifiers(`.a{background:url("img/x.png")} .b{background:url(data:image/svg+xml,abc)} .c{src:url('https://x/y.woff')}`), ["img/x.png"]);
assert.equal(globToRegExp("aria-kb-pack/**/*").test("aria-kb-pack/diagnostics/x.json"), true);
assert.equal(globToRegExp("src/**/*").test("src/shared/revenue-board.mjs"), true, "a src wildcard admits the excluded set — which is why the test below forbids one");
assert.equal(globToRegExp("src/main/main.mjs").test("src/main/main.mjs"), true);
assert.equal(globToRegExp("src/main/main.mjs").test("src/main/main.mjsx"), false, "an explicit path is exact");
assert.equal(globToRegExp("build/icon-256.png").test("build/icon.ico"), false);
assert.equal(buildFilesCover(["!src/x.mjs", "src/x.mjs"], "src/x.mjs"), true);

// ---- the graph itself ------------------------------------------------------------------------------------------
for (const e of ENTRY_FILES) assert.ok(fs.existsSync(path.join(ROOT, e)), `entry exists: ${e}`);
for (const d of [...ENTRY_HTML_DIRS, ...ENTRY_DIRS]) assert.ok(fs.existsSync(path.join(ROOT, d)), `entry dir exists: ${d}`);
for (const must of ["src/renderer/index.html", "src/renderer/overlay.html", "src/overlay/plan-picker.html", "src/overlay/action-indicator.html"]) {
  assert.ok(graph.entries.includes(must), `customer page is an entry: ${must}`);
}
assert.ok(graph.reachable.length >= 150, `the customer graph is substantial (${graph.reachable.length} files)`);
assert.ok(graph.unreachable.length >= 60, `the excluded set is substantial (${graph.unreachable.length} files stay out)`);
// Known chains the product depends on — if the resolver broke, these would vanish first.
for (const must of [
  "src/main/main.mjs", "src/main/preload.cjs", "src/renderer/renderer.js", "src/renderer/sentinel.css", "src/renderer/aria-live-globe.svg",
  "src/renderer/components/aria-globe.mjs", "src/renderer/local-stt.mjs", "src/shared/recipes.mjs", "src/shared/pricing-tiers.mjs",
  "src/shared/network-capture.mjs", "src/shared/aria-brain.cjs", "src/shared/aria-topics-fallback.mjs", "src/main/tray-art-png.mjs",
  "src/sub-agents/detection/index.mjs", "src/main/recipes/tier-0/catalog.mjs", "src/recipes/scripts/flush-dns.ps1"
]) assert.ok(graph.reachable.includes(must), `reachable: ${must}`);
assert.deepEqual(graph.outside, ["package.json"], "the only file the graph reaches outside src/ is package.json (createRequire), covered by the fixed list");

// ---- (a) every reachable file ships; the list is explicit; nothing stale ----------------------------------------
const d = diffBuildFiles(pkg, graph);
assert.deepEqual(d.missing, [], `reachable files not covered by build.files (run: node scripts/customer-build-manifest.mjs --write):\n  ${d.missing.join("\n  ")}`);
assert.deepEqual(d.wildcardSrc, [], `src/ entries must be explicit paths, never globs: ${d.wildcardSrc.join(", ")}`);
assert.deepEqual(d.extra, [], `build.files lists src/ files the graph no longer reaches (stale): ${d.extra.join(", ")}`);
assert.deepEqual(d.admitsExcluded, [], `build.files admits an unreachable module: ${d.admitsExcluded.join(", ")}`);
for (const f of FIXED_BUILD_FILES) assert.ok(files.includes(f), `fixed extra is listed: ${f}`);
for (const f of ["package.json", "README-MVP.md", ".env.example", "build/icon-256.png"]) assert.ok(fs.existsSync(path.join(ROOT, f)), `fixed extra exists on disk: ${f}`);
for (const dir of ["aria-kb-pack", "chrome-extension", "edge-extension"]) assert.ok(fs.existsSync(path.join(ROOT, dir)), `data folder exists: ${dir}`);
assert.deepEqual(files, expectedBuildFiles(graph.reachable), "build.files is exactly the fixed extras followed by the sorted reachable set");
// Every src entry in build.files points at a file that exists (an explicit path that is gone is a packaging error).
for (const f of files.filter((x) => x.startsWith("src/"))) assert.ok(fs.existsSync(path.join(ROOT, f)), `listed file exists: ${f}`);
// The RUN 23e exclusions still hold (admin console via extraResources, never tests/docs/design-review/axis).
for (const bad of ["tests", "docs/", "design-review", "axis/", "admin-console", "fixtures", "cowork-tools", "dev-docs", "qa/"]) {
  assert.ok(!files.some((f) => f.includes(bad)), `build.files never ships ${bad}`);
}
assert.ok((pkg.build.extraResources || []).some((e) => String(e).includes("admin-console")), "admin console still ships via extraResources (RUN 23e)");

// ---- (b) the business-ops modules exist, and none is reachable ---------------------------------------------------
assert.ok(EXCLUDED_BUSINESS_MODULES.length >= 70, `the excluded list is the audit's set (${EXCLUDED_BUSINESS_MODULES.length})`);
for (const m of EXCLUDED_BUSINESS_MODULES) {
  const rel = `src/shared/${m}.mjs`;
  assert.ok(fs.existsSync(path.join(ROOT, rel)), `excluded module still exists in the repo (Rule 15 — nothing deleted): ${rel}`);
  assert.ok(!graph.reachable.includes(rel), `business-ops module is NOT reachable from any customer surface: ${rel}`);
  assert.ok(!buildFilesCover(files, rel), `business-ops module is NOT in build.files: ${rel}`);
}
for (const m of ["revenue-board", "acquisition-funnel", "deal-blocker-autopsy", "the-hour", "week-record", "objection-ledger", "pricing-floor", "sentinel-license-funnel"]) {
  assert.ok(EXCLUDED_BUSINESS_MODULES.includes(m), `the audit's named module is on the excluded list: ${m}`);
}

// ---- (c) the renderer / overlay never references an excluded module ---------------------------------------------
const uiFiles = [];
for (const dir of ["src/renderer", "src/overlay"]) {
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r); else if (/\.(mjs|js|cjs|html)$/.test(e.name)) uiFiles.push(r);
    }
  })(dir);
}
assert.ok(uiFiles.length >= 10, "the UI sources were found");
const excludedNames = new Set(EXCLUDED_BUSINESS_MODULES);
for (const f of uiFiles) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  for (const spec of codeSpecifiers(src)) {
    const base = path.basename(spec).replace(/\.(mjs|cjs|js)$/, "");
    assert.ok(!excludedNames.has(base), `${f} imports an excluded business module: ${spec}`);
  }
}
// And no shipped src file (reachable) imports one either — the graph would have pulled it in, so prove the contrapositive.
for (const f of graph.reachable.filter((x) => /\.(mjs|cjs|js)$/.test(x))) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  for (const spec of codeSpecifiers(src)) {
    const base = path.basename(spec).replace(/\.(mjs|cjs|js)$/, "");
    assert.ok(!excludedNames.has(base), `shipped file ${f} imports an excluded business module: ${spec}`);
  }
}

// ---- the writer is deterministic and keeps every other package.json key ------------------------------------------
const rewritten = JSON.parse(rewritePackageBuildFiles(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"), graph));
assert.deepEqual(rewritten.build.files, files, "--write is a no-op on an up-to-date tree");
assert.equal(rewritten.version, pkg.version);
assert.deepEqual(rewritten.scripts, pkg.scripts);
assert.deepEqual(rewritten.build.win, pkg.build.win);

// ---- the drift detector catches the wildcard that caused the leak ------------------------------------------------
const leaky = { build: { files: ["package.json", "src/**/*"] } };
const dl = diffBuildFiles(leaky, graph);
assert.deepEqual(dl.missing.filter((f) => f.startsWith("src/")), [], "a wildcard covers the reachable set…");
assert.deepEqual(dl.wildcardSrc, ["src/**/*"], "…but is reported as a wildcard…");
assert.deepEqual(dl.admitsExcluded, ["src/**/*"], "…that admits the excluded modules");
const stale = { build: { files: [...files, "src/shared/does-not-exist.mjs"] } };
assert.deepEqual(diffBuildFiles(stale, graph).extra, ["src/shared/does-not-exist.mjs"], "a stale explicit entry is reported");
const partial = { build: { files: files.filter((f) => f !== "src/main/main.mjs") } };
assert.deepEqual(diffBuildFiles(partial, graph).missing, ["src/main/main.mjs"], "a dropped reachable file is reported");

console.log(`customer-build-allowlist test passed (${graph.reachable.length} reachable src files ship · ${graph.unreachable.length} stay out · ${EXCLUDED_BUSINESS_MODULES.length} business-ops modules proven unreachable and unreferenced by the UI · explicit allow-list, no src wildcard).`);
