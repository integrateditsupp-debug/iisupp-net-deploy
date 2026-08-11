// scripts/lib/deploy-denylist.mjs — RUN-BA / BA0.
//
// WHY THIS FILE EXISTS.
//
// The security lockdown (2026-07-01) declared a list of paths that must never be TRACKED, because
// this repository's publish dir is "." — every tracked path ships to a clone and to the live deploy.
// `tests/deploy-safety-denylist.test.mjs` has enforced that list since. It works: it caught this.
//
// What it could not do is stop the write. It is a REPORT, read after the fact, and the one moment
// it is not read is the moment the last write of a cycle happens — the ledger head, the queue, the
// run file. RUN-AZ's final two commits (`34d8ef8`, `0f6cb80`) named ten `senior-director-state/`
// paths as `--file` arguments to the plumbing committer, which added them without objection, and
// the registry was never re-read afterwards. The cycle reported "exit 0 after every write" and that
// sentence was true of every write except the last one.
//
// So the list moves here, to ONE place, and the committer refuses instead of the test reporting.
// A check that runs after the irreversible act is a smoke alarm in the car park.
//
// Rule 15: nothing is removed. The test keeps its own assertions and its own error text; it imports
// the vocabulary rather than re-declaring it, so the two can never disagree again.

// ARIA Sentinel is the one exception: its recipe/build scripts (*.ps1/*.bat) and its CLAUDE.md are
// desktop-product SOURCE and must stay in git. The whole subtree is force-404'd live via the
// `/ARIA Sentinel/*` redirect, so it never serves.
export const SENTINEL_PREFIX = "ARIA Sentinel/";

// backups/ is deliberately NOT denied: main legitimately tracks 7 code-backup files there (no PII),
// already force-404'd live via `/backups/*`.
export const DENY_PREFIXES = [
  "aria-vault/",
  "senior-director-state/",
  "documents/",
  "ARIA-Vault-Backups/",
  "_vault-backups",
];

/**
 * Is this repo-relative path forbidden from being tracked by git?
 * Mirrors tests/deploy-safety-denylist.test.mjs exactly — that is the point of this module.
 * @param {string} file repo-relative path, forward slashes, as `git ls-files` emits it
 * @returns {false | { file: string, rule: string }} false when clean, else the rule that refused it
 */
export function denylistViolation(file) {
  const f = String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!f) return false;

  const prefix = DENY_PREFIXES.find((p) => f.startsWith(p));
  if (prefix) return { file: f, rule: `path is under the denied prefix "${prefix}"` };

  // The Sentinel exemption is checked AFTER the prefixes, never before: a denied prefix inside the
  // Sentinel tree is still denied. Order is load-bearing, so it is stated rather than implied.
  if (f.startsWith(SENTINEL_PREFIX)) return false;

  if (f === "CLAUDE.md" || f.endsWith("/CLAUDE.md")) return { file: f, rule: "CLAUDE.md is operator instruction, never shipped" };
  if (/\.(cmd|bat|ps1)$/i.test(f)) return { file: f, rule: "operator script (.cmd/.bat/.ps1) outside the Sentinel product tree" };
  if (f.toLowerCase().endsWith(".tar.gz")) return { file: f, rule: "archive (.tar.gz) — never shipped" };
  return false;
}

/** @returns {Array<{file: string, rule: string}>} every violation in the list, never just the first */
export function denylistViolations(files) {
  const out = [];
  for (const f of files || []) {
    const v = denylistViolation(f);
    if (v) out.push(v);
  }
  return out;
}
