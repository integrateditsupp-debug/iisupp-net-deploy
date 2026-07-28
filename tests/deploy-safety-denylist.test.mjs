#!/usr/bin/env node
// tests/deploy-safety-denylist.test.mjs — SECURITY LOCKDOWN 2026-07-01
// publish dir = "." → every git-tracked path ships to clones AND the live deploy.
// This test walks `git ls-files` and FAILS if any internal path is tracked, making
// the CLAUDE.md/vault leak class impossible to reintroduce silently.
// Packet: documents/product-engineering/SECURITY-LOCKDOWN-PACKET-CC-2026-07-01.md
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
const files = out.toString("utf8").split("\0").filter(Boolean);

// ARIA Sentinel is the one exception: its recipe/build scripts (*.ps1/*.bat) and CLAUDE.md
// are desktop-product source that must stay in git; the whole tree is force-404'd live
// via the /ARIA Sentinel/* redirect, so it never serves.
// backups/ is NOT denied: main legitimately tracks 7 code-backup files there (no PII),
// already force-404'd live via /backups/*.
const SENTINEL_PREFIX = "ARIA Sentinel/";

const DENY_PREFIXES = [
  "aria-vault/",
  "senior-director-state/",
  "documents/",
  "ARIA-Vault-Backups/",
  "_vault-backups",
];

const violations = files.filter((f) => {
  if (DENY_PREFIXES.some((p) => f.startsWith(p))) return true;
  if (f.startsWith(SENTINEL_PREFIX)) return false;
  if (f === "CLAUDE.md" || f.endsWith("/CLAUDE.md")) return true;
  if (/\.(cmd|bat|ps1)$/i.test(f)) return true;
  if (f.toLowerCase().endsWith(".tar.gz")) return true;
  return false;
});

if (violations.length) {
  console.error(`DEPLOY-SAFETY DENYLIST — ${violations.length} internal path(s) tracked by git (must NEVER ship):`);
  for (const v of violations.slice(0, 50)) console.error("  " + v);
  if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`);
  throw new Error(`deploy-safety-denylist: ${violations.length} denylisted path(s) tracked — run \`git rm --cached\` on them before committing.`);
}

// ── SERVING-LAYER LOCKDOWN 2026-07-02 (T3) — the force-404 redirect block must exist for every
// internal path. Rules can't silently vanish in a merge: this fails the suite if netlify.toml
// loses any of them. (Serving-layer LIVE behavior is covered by scripts/probe-deploy-safety.mjs —
// this only locks the config; the 2026-07-02 incident proved config alone isn't sufficient.)
import { readFileSync } from "node:fs";

const REQUIRED_FORCE_404 = [
  "/aria-vault/*",
  "/senior-director-state/*",
  "/documents/*",
  "/CLAUDE.md",
  "/ARIA-Vault-Backups/*",
  "/backups/*",
  "/AGENT_EXECUTION_NOTES.md",
  "/COLLAB-CLAUDE-CODEX.md",
  "/CC-BRIEF.md",
  // 2026-07-02 amendment: ops + functions source must never serve either (the probe script
  // lives under /scripts; /netlify holds function sources).
  "/scripts/*",
  "/netlify/*"
];

const toml = readFileSync(path.join(repoRoot, "netlify.toml"), "utf8");
const blocks = toml.split("[[redirects]]").slice(1);
const missing = REQUIRED_FORCE_404.filter((from) => !blocks.some((b) =>
  b.includes(`from = "${from}"`) && /status\s*=\s*404/.test(b) && /force\s*=\s*true/.test(b)
));
if (missing.length) {
  throw new Error(`deploy-safety-denylist: netlify.toml is missing force-404 rules for: ${missing.join(", ")} — the serving-layer lockdown block was removed or altered.`);
}

// ── PUBLIC-FILE CONTENT SCAN 2026-07-02 (DP-1) — the files we INTENTIONALLY serve (the AXIS
// status feed + security.txt) reach any anonymous visitor + search indexing. The path lockdown
// above proves internal paths refuse; this adds the missing invariant that the PUBLIC files carry
// ZERO business-sensitive specifics. Regression-proofs the status.json pipeline-leak class
// (RUN-E-ON-DD724EE gate review DP-1). Real specifics live ONLY under the force-404'd
// senior-director-state/opportunity-engine board. Sensitive proper-noun tokens are built from
// char codes at runtime so this tracked test never embeds them literally (same discipline as
// probe-deploy-safety.test.mjs).
const cc = (...codes) => String.fromCharCode(...codes);
const SENSITIVE_CONTENT = [
  { re: /\bW\d{3,5}\b/, reason: "tender/opportunity id" },
  { re: /go\/no-?go/i, reason: "deal decision-gate phrasing" },
  { re: new RegExp("\\b" + cc(65, 114, 105, 98, 97) + "\\b", "i"), reason: "procurement-platform name" },
  { re: new RegExp(cc(79, 112, 101, 110, 84, 101, 120, 116), "i"), reason: "partner/deal name" },
  { re: new RegExp(cc(83, 82, 73) + "\\s+registration", "i"), reason: "procurement-registration specifics" },
  { re: /prospect\s+follow-?ups?/i, reason: "prospect/pipeline count" },
  { re: /\$\s?\d[\d,]*(?:\.\d+)?\s*[kKmM]?\b/, reason: "dollar pipeline figure" },
];

// Files that are SUPPOSED to serve publicly (not force-404'd). Absent mirrors are skipped.
const PUBLIC_SERVED_FILES = [
  ".well-known/axis/status.json",
  "public/.well-known/axis/status.json",
  ".well-known/security.txt",
];

const contentLeaks = [];
for (const rel of PUBLIC_SERVED_FILES) {
  let text;
  try {
    text = readFileSync(path.join(repoRoot, rel), "utf8");
  } catch {
    continue; // an absent public file cannot leak
  }
  for (const { re, reason } of SENSITIVE_CONTENT) {
    if (re.test(text)) contentLeaks.push(`${rel}: ${reason}`);
  }
}
if (contentLeaks.length) {
  console.error(`DEPLOY-SAFETY PUBLIC-CONTENT — ${contentLeaks.length} sensitive pattern(s) in publicly-served file(s):`);
  for (const c of contentLeaks) console.error("  " + c);
  throw new Error(`deploy-safety-denylist: a publicly-served file carries business-sensitive specifics — scrub it (tender ids / deal names / decision-gates / pipeline counts / $ figures belong ONLY under the force-404'd senior-director-state board).`);
}

// ── AXIS STATUS LEAK-CLASS SCAN 2026-07-21 — the flywheel repeatedly re-leaked build internals (git SHAs,
// cc/ branch names, AHMAD-*.cmd operator scripts, lock state) into the .well-known/axis/status.json mirrors;
// the 9f40a6c2 trim missed the public/ mirror entirely. The only sanctioned writer is now
// scripts/lib/axis-status-emit.mjs (headline-only allowlist). This scan imports the SAME LEAK_PATTERNS,
// so a future run that hand-writes either mirror fails the suite even if it never touches the emitter.
const { LEAK_PATTERNS, PUBLIC_STATUS_FILES } = await import(
  pathToFileURL(path.join(repoRoot, "scripts", "lib", "axis-status-emit.mjs")).href
);
const statusLeaks = [];
for (const rel of PUBLIC_STATUS_FILES) {
  let text;
  try { text = readFileSync(path.join(repoRoot, rel), "utf8"); } catch { continue; }
  for (const [re, reason] of LEAK_PATTERNS) {
    const m = text.match(re);
    if (m) statusLeaks.push(`${rel}: ${reason} ("${String(m[0]).slice(0, 50)}")`);
  }
}
if (statusLeaks.length) {
  console.error(`DEPLOY-SAFETY AXIS-STATUS — ${statusLeaks.length} leak-class pattern(s) in PUBLIC status mirror(s):`);
  for (const c of statusLeaks) console.error("  " + c);
  throw new Error(`deploy-safety-denylist: a public AXIS status mirror carries internal build state — regenerate it with scripts/lib/axis-status-emit.mjs (full detail belongs in netlify/functions/_axis-status-full.json, served only via /api/axis-status).`);
}

console.log(`deploy-safety-denylist: OK — 0 of ${files.length} tracked paths match the internal denylist; all ${REQUIRED_FORCE_404.length} force-404 rules present in netlify.toml; ${PUBLIC_SERVED_FILES.length} public files scanned, 0 sensitive-content leaks.`);
