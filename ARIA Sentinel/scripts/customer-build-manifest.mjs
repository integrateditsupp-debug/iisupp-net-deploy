// F4 2026-10-14 (audit M16 / R7 / §4 "simplify without losing") — THE CUSTOMER BUILD SHIPS ONLY WHAT A CUSTOMER
// SURFACE CAN REACH.
//
// Why: `build.files` was `src/**/*`, so the customer .exe carried 121 of 251 src files (846 KB) that no customer
// entry point imports — the founder's sales/acquisition tooling (revenue-board, acquisition-funnel, candidate-*,
// deal-blocker-autopsy, the-hour, pricing-floor, …), readable by anyone who unpacks app.asar. Those modules stay in
// the repo (Rule 15: the admin console, Cowork tools and their suites still use them); they simply stop shipping.
//
// What this does: walks the import graph from the CUSTOMER entry points (main process, preload, every renderer and
// overlay page with their scripts/styles/images, the detection sub-agents, the Tier-0 recipe catalog, the bundled
// PowerShell mirrors) and emits the reachable file list. `build.files` in package.json is the explicit allow-list
// derived from it plus the fixed non-code extras (package.json, README-MVP.md, .env.example, aria-kb-pack, the two
// browser extensions, build/icon-256.png). Nothing is inferred from a wildcard any more.
//
//   node scripts/customer-build-manifest.mjs            → prints the manifest (JSON) to stdout
//   node scripts/customer-build-manifest.mjs --check    → exit 1 when package.json build.files drifts from the graph
//   node scripts/customer-build-manifest.mjs --write    → rewrites package.json build.files from the graph
//   node scripts/customer-build-manifest.mjs --list     → one reachable path per line
//
// Pure where it matters: computeReachable(root) and diffBuildFiles(pkg, expected) take paths/objects and do no
// writes, so tests/customer-build-allowlist.test.mjs proves the allow-list without touching the tree.
// 🔒 R11 — only repo-relative source paths are ever read or printed; never a user folder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Code entry points: the main process and its preload. */
export const ENTRY_FILES = Object.freeze(["src/main/main.mjs", "src/main/preload.cjs"]);

/** Directories whose HTML pages are customer surfaces (their scripts/styles/images are followed from the HTML). */
export const ENTRY_HTML_DIRS = Object.freeze(["src/renderer", "src/overlay"]);

/** Directories shipped WHOLESALE: every file under them is a customer entry (watchers, Tier-0 catalog, .ps1 mirrors). */
export const ENTRY_DIRS = Object.freeze(["src/sub-agents", "src/main/recipes", "src/recipes/scripts"]);

/**
 * Non-code extras the customer build always carries, in the order they appear in build.files. Globs are kept for
 * data folders (the KB pack and the two browser extensions are content, not code); everything under src/ is explicit.
 */
export const FIXED_BUILD_FILES = Object.freeze([
  "package.json",
  "README-MVP.md",
  ".env.example",
  "aria-kb-pack/**/*",
  "chrome-extension/**/*",
  "edge-extension/**/*",
  "build/icon-256.png"
]);

/**
 * Business-ops / sales / server-only modules under src/shared that must NEVER reach a customer build (audit-main §4,
 * expanded from the audit's prefixes to the real file names). Kept in the repo for the admin console, the Netlify
 * functions and the Cowork tools; tests/customer-build-allowlist.test.mjs asserts every one exists, none is reachable
 * from a customer surface, and no renderer/overlay source references one. Basenames without extension.
 * (Unwired PRODUCT modules — the STAGE 3 plan engine, root-cause-correlation, multi-hypothesis… — are simply
 * "not reachable today" and are reported, not asserted: wiring one in is a product decision, not a leak.)
 */
export const EXCLUDED_BUSINESS_MODULES = Object.freeze([
  // founder sales pipeline / acquisition / outreach
  "revenue-board", "revenue-truth-board", "acquisition-funnel", "demand-intake", "demand-to-ask-conveyor",
  "followup-cadence", "billing-handoff", "close-packet", "one-page-ask", "sentinel-license-funnel", "conversion-digest",
  "weekly-truth-digest", "weekly-digest", "quarterly-email", "pilot-console", "proof-pack", "program-truth",
  "outbound-truth", "operator-brief", "objection-ledger", "moves-without-us", "cost-of-delay", "deal-blocker-autopsy",
  "durability-ledger", "send-packet", "second-message", "rendered-ask", "renewal-readiness", "pricing-floor",
  "payment-receipt-ledger", "blocker-surface", "warm-redirect-queue", "name-sources", "directory", "account-intake",
  "metrics", "ledger-head", "visit-log",
  // candidate-* / ask-* / first-* / hour-* / week-* / passive-* / delivery-* / reply-* (the audit's prefixes)
  "candidate-bridge", "candidate-fit", "candidate-quick-entry", "candidate-record",
  "ask-dashboard", "ask-ledger", "ask-ready-queue", "ask-staging",
  "first-account-walk", "first-hour-loop", "first-packet-pass", "first-reply-surface",
  "hour-change", "hour-plan", "the-hour", "spent-hour", "staged-hour", "next-hour", "repeat-hours", "repeatability-audit",
  "week-record", "week-reentry", "unopened-week", "waiting-interval", "time-to-first-dollar",
  "passive-outcomes", "passive-surface", "delivery-capacity-truth", "delivery-leverage", "reply-capture", "reply-rate",
  "goal-probe-grade", "held-silence", "honest-opening", "elapsed-since",
  // server / admin-console / fleet plumbing that the desktop never imports
  "fleet", "fleet-aggregate", "license-registry", "heartbeat-server", "api-v1", "admin-auth", "admin-gate",
  "cowork-redact", "status-badge", "update-events", "patch-management"
]);

const CODE_EXT = [".mjs", ".cjs", ".js"];
const RESOLVE_TRIES = ["", ".mjs", ".js", ".cjs", "/index.mjs", "/index.js"];

const toPosix = (p) => p.split(path.sep).join("/");

/** Every relative specifier a code file imports/requires (bare specifiers like "electron" are skipped). */
export function codeSpecifiers(source) {
  const out = new Set();
  const re = [
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,                         // import("./x")
    /\b(?:import|export)\s+(?:[^"'`;]+?\s+from\s+)?["']([^"']+)["']/g,  // import x from "./x" · export * from "./x" · import "./x"
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,                        // require("./x")
    /createRequire\([^)]*\)\s*\(\s*["']([^"']+)["']\s*\)/g            // createRequire(import.meta.url)("../../package.json")
  ];
  for (const r of re) for (const m of source.matchAll(r)) if (/^\.\.?\//.test(m[1])) out.add(m[1]);
  return [...out];
}

/** Every relative asset an HTML page references via src=/href= (http(s), data:, mailto:, tel:, #, javascript: skipped). */
export function htmlSpecifiers(source) {
  const out = new Set();
  for (const m of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const v = m[1].trim();
    if (!v || /^(https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(v)) continue;
    out.add(v.replace(/[?#].*$/, ""));
  }
  return [...out];
}

/** Every relative url(...) a stylesheet references. */
export function cssSpecifiers(source) {
  const out = new Set();
  for (const m of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const v = m[1].trim();
    if (!v || /^(https?:|data:|#|\/\/)/i.test(v)) continue;
    out.add(v.replace(/[?#].*$/, ""));
  }
  return [...out];
}

function resolveRelative(root, fromRel, spec) {
  const base = path.join(root, path.dirname(fromRel), spec);
  for (const t of RESOLVE_TRIES) {
    const cand = base + t;
    try { if (fs.statSync(cand).isFile()) return toPosix(path.relative(root, cand)); } catch { /* try next */ }
  }
  return null;
}

function walkDir(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) walkDir(root, r, out);
    else out.push(r);
  }
  return out;
}

/**
 * Walk the customer graph. Returns { entries, reachable, unreachable, outside, edges } — all repo-relative POSIX paths,
 * sorted. `reachable` is every file inside src/ the customer build must carry; `outside` is the handful of files the
 * graph reaches outside src/ (package.json via createRequire) — they are covered by FIXED_BUILD_FILES; `unreachable`
 * is every src/ file nothing reaches (kept in the repo, never shipped).
 */
export function computeReachable(root = ROOT) {
  const entries = new Set(ENTRY_FILES);
  for (const d of ENTRY_HTML_DIRS) for (const f of walkDir(root, d)) if (f.endsWith(".html")) entries.add(f);
  for (const d of ENTRY_DIRS) for (const f of walkDir(root, d)) entries.add(f);

  const seen = new Set();
  const edges = {};
  const queue = [...entries].filter((f) => fs.existsSync(path.join(root, f)));
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const ext = path.extname(f).toLowerCase();
    let specs = [];
    let src = "";
    if (CODE_EXT.includes(ext) || ext === ".html" || ext === ".css") src = fs.readFileSync(path.join(root, f), "utf8");
    if (CODE_EXT.includes(ext)) specs = codeSpecifiers(src);
    else if (ext === ".html") specs = htmlSpecifiers(src).concat(codeSpecifiers(src));
    else if (ext === ".css") specs = cssSpecifiers(src);
    const targets = [];
    for (const s of specs) {
      const rel = resolveRelative(root, f, /^\.\.?\//.test(s) ? s : `./${s}`);
      if (rel) { targets.push(rel); queue.push(rel); }
    }
    if (targets.length) edges[f] = [...new Set(targets)].sort();
  }

  const all = walkDir(root, "src").sort();
  const reachable = all.filter((f) => seen.has(f));
  const unreachable = all.filter((f) => !seen.has(f));
  const outside = [...seen].filter((f) => !f.startsWith("src/")).sort();
  return { entries: [...entries].sort(), reachable, unreachable, outside, edges };
}

/** The build.files allow-list the graph implies: fixed extras first (stable order), then every reachable src file. */
export function expectedBuildFiles(reachable) {
  return [...FIXED_BUILD_FILES, ...reachable];
}

/** Minimal glob → RegExp for electron-builder style patterns (`**`, `*`, `?`). Exact paths match themselves. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Does any allow-list entry cover this repo-relative file? */
export function buildFilesCover(files, rel) {
  return (files || []).some((g) => !String(g).startsWith("!") && globToRegExp(String(g)).test(rel));
}

/**
 * Compare package.json build.files with the graph. { missing: reachable files no entry covers, extra: src/ entries in
 * build.files that match NO reachable file (a stale explicit path or a wildcard that would re-admit the excluded set),
 * wildcardSrc: any src/ entry that is a glob }.
 */
export function diffBuildFiles(pkg, graph) {
  const files = (pkg && pkg.build && pkg.build.files) || [];
  const missing = graph.reachable.filter((f) => !buildFilesCover(files, f));
  const srcEntries = files.filter((g) => String(g).startsWith("src/"));
  const wildcardSrc = srcEntries.filter((g) => /[*?]/.test(String(g)));
  const extra = srcEntries.filter((g) => !graph.reachable.some((f) => globToRegExp(String(g)).test(f)));
  const admitsExcluded = srcEntries.filter((g) => graph.unreachable.some((f) => globToRegExp(String(g)).test(f)));
  return { missing, extra, wildcardSrc, admitsExcluded };
}

/** Rewrite build.files in a package.json TEXT (pure; preserves every other key + 2-space formatting + trailing newline). */
export function rewritePackageBuildFiles(pkgText, graph) {
  const pkg = JSON.parse(pkgText);
  pkg.build = pkg.build || {};
  pkg.build.files = expectedBuildFiles(graph.reachable);
  return JSON.stringify(pkg, null, 2) + "\n";
}

export function manifest(root = ROOT) {
  const g = computeReachable(root);
  return {
    schema: "customer-build-manifest/1",
    generatedAt: new Date().toISOString(),
    entries: g.entries,
    fixed: [...FIXED_BUILD_FILES],
    reachableCount: g.reachable.length,
    unreachableCount: g.unreachable.length,
    reachable: g.reachable,
    unreachable: g.unreachable,
    outside: g.outside
  };
}

function main(argv) {
  const g = computeReachable(ROOT);
  const pkgPath = path.join(ROOT, "package.json");
  if (argv.includes("--write")) {
    fs.writeFileSync(pkgPath, rewritePackageBuildFiles(fs.readFileSync(pkgPath, "utf8"), g));
    console.error(`[customer-build-manifest] package.json build.files rewritten: ${FIXED_BUILD_FILES.length} fixed + ${g.reachable.length} reachable src files (${g.unreachable.length} src files stay out of the build).`);
    return 0;
  }
  if (argv.includes("--check")) {
    const d = diffBuildFiles(JSON.parse(fs.readFileSync(pkgPath, "utf8")), g);
    const bad = d.missing.length || d.extra.length || d.wildcardSrc.length || d.admitsExcluded.length;
    if (bad) {
      console.error("[customer-build-manifest] DRIFT between the import graph and package.json build.files:");
      for (const f of d.missing) console.error(`  missing (reachable, not shipped): ${f}`);
      for (const f of d.extra) console.error(`  stale   (listed, reaches nothing): ${f}`);
      for (const f of d.wildcardSrc) console.error(`  wildcard under src/ (must be explicit): ${f}`);
      for (const f of d.admitsExcluded) console.error(`  admits an unreachable module: ${f}`);
      console.error("  fix: node scripts/customer-build-manifest.mjs --write");
      return 1;
    }
    console.error(`[customer-build-manifest] OK — build.files matches the graph (${g.reachable.length} reachable src files, ${g.unreachable.length} excluded).`);
    return 0;
  }
  if (argv.includes("--list")) { process.stdout.write(g.reachable.join("\n") + "\n"); return 0; }
  process.stdout.write(JSON.stringify(manifest(ROOT), null, 2) + "\n");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
