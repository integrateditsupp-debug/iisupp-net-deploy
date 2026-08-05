// gen-root-serving-denies.mjs — regenerate the force-404 block that hides operator files
// living at the repository root from the public site.
//
// WHY THIS EXISTS (found run 145, 2026-07-29, RUN-AD):
//   netlify.toml sets `publish = "."`. Everything at the repository root is therefore a URL.
//   Directories were force-404'd one by one and root files were force-404'd ONE FILE AT A TIME
//   (AGENT_EXECUTION_NOTES.md, CC-BRIEF.md, CLAUDE.md, package.json ...). That approach silently
//   missed 100+ other root files: every AHMAD-*.cmd operator script, every LOOP-*.bat, every
//   _*-log.txt build log, and the _incoming-patches/ directory. Netlify's splat may only appear at
//   the END of a path, so `/*.cmd` is not a supported rule — the only reliable fix is one explicit
//   rule per file, generated rather than remembered.
//
//   Nothing is deleted (Rule 15). The files stay exactly where they are; they simply stop being
//   fetchable by strangers once the site is published.
//
// The companion test `tests/root-serving-gate.test.mjs` FAILS if any internal-looking root file or
// internal root directory has no rule, so a new operator script cannot quietly become a public URL.
//
// Run:  node scripts/gen-root-serving-denies.mjs        (rewrites the marked block in netlify.toml)
//       node scripts/gen-root-serving-denies.mjs --check (exit 1 if the block is out of date)

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const BEGIN = "# >>> BEGIN generated root-serving denies (scripts/gen-root-serving-denies.mjs)";
export const END = "# <<< END generated root-serving denies";

// Extensions that are NEVER public when they sit at the repository root.
const INTERNAL_EXT = [
  ".cmd", ".bat", ".ps1", ".sh", ".patch", ".md", ".log", ".mjs", ".cjs",
  ".py", ".zip", ".gz", ".tgz", ".bak", ".lock", ".yml", ".yaml", ".toml",
];

// Root directories that are operator-internal. (Others are already covered in netlify.toml.)
const INTERNAL_DIRS = [
  "_incoming-patches", "_branch-src", "_shipped-src", "_staged-cc-runs",
  "_vault-backups", "_vault-backups-L2", "_vault-backups-mirror",
  "AI OS and Command center Design Request", "Project AEGIS - Governance", "USA Outreach",
  "tmp", "loops", "src", "tools", "sdk", "odysseus", ".codex-observer", ".github",
];

// Root files that are deliberately public even though the heuristic would catch them.
const PUBLIC_ALLOW = new Set(["robots.txt", "sitemap.xml", "site.webmanifest", "_headers", "_redirects"]);

export function isInternalRootFile(name) {
  if (PUBLIC_ALLOW.has(name)) return false;
  if (name.startsWith("_")) return true;                 // every _*-log.txt / _probe_* artifact
  if (name === "cowork-write-test.txt") return true;
  const lower = name.toLowerCase();
  return INTERNAL_EXT.some((e) => lower.endsWith(e));
}

export function collectRootTargets(root) {
  const files = [];
  const dirs = [];
  for (const entry of readdirSync(root)) {
    let s;
    try { s = statSync(join(root, entry)); } catch { continue; }
    if (s.isDirectory()) {
      if (INTERNAL_DIRS.includes(entry)) dirs.push(entry);
    } else if (isInternalRootFile(entry)) {
      files.push(entry);
    }
  }
  return { files: files.sort(), dirs: dirs.sort() };
}

// Netlify matches the literal path. Spaces and other unsafe characters get a percent-encoded twin
// so both the raw and the encoded URL are refused.
function rulesFor(path) {
  const variants = new Set([path]);
  const enc = path.split("/").map((seg) => encodeURIComponent(seg)).join("/");
  if (enc !== path) variants.add(enc);
  return [...variants];
}

export function renderBlock(root) {
  const { files, dirs } = collectRootTargets(root);
  const out = [
    BEGIN,
    "# Generated. Do not hand-edit — run scripts/gen-root-serving-denies.mjs.",
    "# publish = \".\" makes every root path a URL. These rules refuse the operator-internal ones.",
    "# Nothing here is deleted or moved (Rule 15); the files simply stop being public.",
    `# ${files.length} file rules, ${dirs.length} directory rules.`,
  ];
  for (const d of dirs) {
    for (const v of rulesFor(`/${d}/*`)) {
      out.push("[[redirects]]", `  from = "${v}"`, '  to = "/404.html"', "  status = 404", "  force = true");
    }
  }
  for (const f of files) {
    for (const v of rulesFor(`/${f}`)) {
      out.push("[[redirects]]", `  from = "${v}"`, '  to = "/404.html"', "  status = 404", "  force = true");
    }
  }
  out.push(END);
  return out.join("\n");
}

export function spliceBlock(toml, block) {
  const b = toml.indexOf(BEGIN);
  const e = toml.indexOf(END);
  if (b !== -1 && e !== -1) return toml.slice(0, b) + block + toml.slice(e + END.length);
  return toml.replace(/\s*$/, "") + "\n\n" + block + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const tomlPath = join(root, "netlify.toml");
  const current = readFileSync(tomlPath, "utf8");
  const next = spliceBlock(current, renderBlock(root));
  if (process.argv.includes("--check")) {
    if (current !== next) {
      console.error("netlify.toml root-serving block is OUT OF DATE. Run: node scripts/gen-root-serving-denies.mjs");
      process.exit(1);
    }
    console.log("root-serving block up to date.");
  } else {
    writeFileSync(tomlPath, next);
    const { files, dirs } = collectRootTargets(root);
    console.log(`root-serving denies regenerated: ${files.length} files, ${dirs.length} directories.`);
  }
}
