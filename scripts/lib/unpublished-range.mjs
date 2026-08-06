// unpublished-range.mjs — RUN-AR / AR1. THE DISTANCE, MEASURED INSTEAD OF ASSERTED.
//
// WHY THIS EXISTS (2026-08-06).
// For twenty-three cycles the ledger has closed with a sentence of the shape "the local line stands
// N commits ahead of the last known shared reference — every commit verified, none published."
// N has been 41, then 48, then 50. It has never once been PRICED. "Fifty commits unpublished" reads
// like an emergency; "fifty commits unpublished, of which two change something a visitor to
// iisupp.net would see" is a different fact entirely, and only one of the two is worth an operator's
// evening. The number was carried for three weeks without anybody asking which one it was.
//
// So this module does not report a count. It reads the commit range out of the repository and
// classifies every commit by what it TOUCHES, and separately reports the set of files in that range
// that a member of the public could actually load. If the customer-visible share is small, that IS
// the finding, and it gets stated plainly rather than folded into a scary total.
//
// WHAT IT REFUSES TO DO.
//   · It does not decide the classes from the commit MESSAGE. A message is a claim by its author;
//     the file list is a fact. Classification is by path, always.
//   · It does not pick one class per commit and hide the rest. A commit that touches a public page
//     and the ledger is counted in BOTH, and the overlap is reported as overlap rather than being
//     silently resolved to whichever class the author would have preferred.
//   · It does not treat "I could not read the range" as zero. An unreadable range is UNREADABLE and
//     says so — a range measured as empty because git refused is the fabricated-metric class this
//     program exists to refuse (Rule 14).
//
// The classification half is PURE — it takes a list of {sha, files} and returns a report, so the
// tests can prove the taxonomy against fixtures without a repository. The read half is the only
// part that shells out.
import { execFileSync } from "node:child_process";

export const UNPUBLISHED_RANGE_SCHEMA = "unpublished-range.v1";
export const SENDS = false;

// Record/field separators for the log read. ASCII control bytes: they cannot occur in a path or
// a commit subject, so a filename containing a newline or a pipe cannot forge a record boundary.
const REC = "\u0001";
const FLD = "\u0002";

/**
 * The classes. Ordered by how much a stranger is affected, most first — that order is the whole
 * point of the module and is asserted by test, not left to the order somebody typed the object.
 */
export const CLASSES = Object.freeze({
  PUBLIC_PAGE: "public-page",              // a file the open internet can load from iisupp.net
  SENTINEL_APP: "sentinel-app",            // the Windows agent a paying customer would install
  SERVING_LAYER: "serving-layer",          // functions, redirects, headers — behaviour of the site
  TOOLING_TESTS: "tooling-and-tests",      // scripts + suites: how we prove things, invisible outside
  RECORD_ONLY: "record-only",              // ledger, run files, feeds, notes — a record of the work
  UNCLASSIFIED: "unclassified",            // a path no rule claims; never folded into any other class
});

export const READ_CLASSES = Object.freeze({
  OK: "range-read-from-the-repository",
  UNREADABLE: "commit-range-could-not-be-read",
  NO_REF: "the-reference-to-compare-against-does-not-exist-here",
});

/**
 * Path rules, most-specific first. Each carries the reason it exists, because a taxonomy without
 * stated reasons is just somebody's preference wearing a constant name.
 */
export const PATH_RULES = Object.freeze([
  {
    class: CLASSES.RECORD_ONLY,
    why: "the operator's own record of the work — a visitor cannot reach it and no product behaviour changes",
    test: (p) => /^senior-director-state\//.test(p)
      || /^documents\//.test(p)
      || /^docs\//.test(p)
      || /^aria-vault\//.test(p)
      || /^\.codex-observer\//.test(p)
      || /(^|\/)(AGENT_EXECUTION_NOTES|CLAUDE|README)\.md$/.test(p)
      || /^netlify\/functions\/_axis-(status|state)-full\.json$/.test(p)
      || /(^|\/)\.well-known\/axis\/[^/]+\.json$/.test(p)
      || /^loops\//.test(p),
  },
  {
    class: CLASSES.SENTINEL_APP,
    why: "the Windows agent itself — changes here reach a customer only after they install a build",
    test: (p) => /^ARIA Sentinel\//.test(p),
  },
  {
    class: CLASSES.TOOLING_TESTS,
    why: "how we prove things to ourselves; nothing outside this machine changes when it changes",
    test: (p) => /^scripts\//.test(p) || /^tests\//.test(p) || /\.test\.mjs$/.test(p),
  },
  {
    class: CLASSES.SERVING_LAYER,
    why: "site behaviour rather than site content — a visitor feels it without seeing a diff",
    test: (p) => /^netlify\//.test(p) || /^netlify\.toml$/.test(p) || /^_redirects$/.test(p) || /^_headers$/.test(p),
  },
  {
    class: CLASSES.PUBLIC_PAGE,
    why: "a file the open internet loads directly — this is the only class a stranger can see",
    test: (p) => /\.(html|css)$/.test(p)
      || (/^assets\//.test(p) && /\.(js|css|json|svg|png|jpg|jpeg|webp|woff2?)$/.test(p))
      // sitemap.xml and robots.txt were UNCLASSIFIED on the first real run of this module and are
      // reclassified here rather than left in the miscellany: a search engine loads both, and a
      // sitemap that lists pages the shared line does not serve is a customer-visible fact.
      || /^(sitemap\.xml|robots\.txt)$/.test(p)
      || (/^public\//.test(p) && !/\.well-known\/axis\//.test(p)),
  },
]);

/** Classify one path. Returns a class name; never throws; never guesses from a commit message. */
export function classifyPath(filePath) {
  const p = String(filePath || "").replace(/^\.\//, "");
  if (!p) return CLASSES.UNCLASSIFIED;
  for (const rule of PATH_RULES) {
    if (rule.test(p)) return rule.class;
  }
  return CLASSES.UNCLASSIFIED;
}

/** The stated reason a class exists, so a report can carry its own justification. */
export function reasonFor(cls) {
  const rule = PATH_RULES.find((r) => r.class === cls);
  if (rule) return rule.why;
  if (cls === CLASSES.UNCLASSIFIED) return "no path rule claims this file; it is reported as unclassified rather than absorbed into a neighbouring class";
  return null;
}

/**
 * PURE. Given commits as [{ sha, subject, files: [path] }], produce the priced report.
 *
 * `byClass[c].commits` counts commits that touch class c AT ALL, so the counts deliberately overlap
 * and their sum is NOT the range size. `commitsTouchingOnly[c]` is the non-overlapping figure — the
 * commits whose entire file list is class c — and both are reported, because "12 commits touch the
 * ledger" and "9 commits touch NOTHING BUT the ledger" answer different questions.
 */
export function priceRange(commits = []) {
  const list = Array.isArray(commits) ? commits : [];
  const byClass = {};
  for (const c of Object.values(CLASSES)) {
    byClass[c] = { class: c, why: reasonFor(c), commits: 0, files: new Set(), exclusiveCommits: 0 };
  }

  const perCommit = list.map((c) => {
    const files = Array.isArray(c.files) ? c.files : [];
    const classes = new Set(files.map(classifyPath));
    for (const cls of classes) byClass[cls].commits += 1;
    for (const f of files) byClass[classifyPath(f)].files.add(f);
    if (classes.size === 1) byClass[[...classes][0]].exclusiveCommits += 1;
    return {
      sha: String(c.sha || ""),
      subject: String(c.subject || ""),
      fileCount: files.length,
      classes: [...classes],
      touchesPublic: classes.has(CLASSES.PUBLIC_PAGE),
    };
  });

  const publicFiles = [...byClass[CLASSES.PUBLIC_PAGE].files].sort();
  const commitsTouchingPublic = perCommit.filter((c) => c.touchesPublic);

  const summary = {
    commits: list.length,
    commitsTouchingPublicPages: commitsTouchingPublic.length,
    publicFilesChanged: publicFiles.length,
    commitsTouchingSentinel: byClass[CLASSES.SENTINEL_APP].commits,
    commitsRecordOnly: byClass[CLASSES.RECORD_ONLY].exclusiveCommits,
    commitsUnclassified: byClass[CLASSES.UNCLASSIFIED].commits,
  };

  return {
    schema: UNPUBLISHED_RANGE_SCHEMA,
    summary,
    // The order is the class order — most-visible first — and is asserted by test.
    byClass: Object.values(CLASSES).map((c) => ({
      class: c,
      why: byClass[c].why,
      commits: byClass[c].commits,
      exclusiveCommits: byClass[c].exclusiveCommits,
      files: [...byClass[c].files].sort(),
    })),
    publicFilesChanged: publicFiles,
    commits: perCommit,
    // The sentence a human should read INSTEAD of the bare count. Generated, never typed.
    statement: statementFor(summary, publicFiles),
  };
}

/** The honest one-liner. Small customer-visible share is stated as the finding, not softened. */
export function statementFor(summary, publicFiles = []) {
  const n = summary.commits;
  if (n === 0) return "Nothing is unpublished: the local line and the shared line are the same commit.";
  const pub = summary.commitsTouchingPublicPages;
  const files = publicFiles.length;
  const head = `${n} commit(s) are built and tested but unpublished.`;
  if (pub === 0) {
    return `${head} None of them changes a file the open internet can load — publishing this range would change nothing a visitor to iisupp.net sees. The backlog is real work and a real record; it is not a customer-facing outage.`;
  }
  return `${head} ${pub} of them touch ${files} file(s) a visitor can load — that share, and only that share, is what publishing would change on screen.`;
}

/**
 * THE READ. Shells out to git for the range. Never converts a refusal into a zero.
 * Returns { ok, class, report|null, detail }.
 */
export function readUnpublishedRange({ root = process.cwd(), ref = "origin/main", head = "HEAD" } = {}) {
  const git = (args) => execFileSync("git", args, {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });

  try { git(["rev-parse", "--verify", `${ref}^{commit}`]); }
  catch (err) {
    return { ok: false, class: READ_CLASSES.NO_REF, report: null,
      detail: `${ref} does not resolve in this checkout — the distance to it is unknown, not zero: ${String(err.message || err).split("\n")[0]}` };
  }

  // The ledger has always quoted `rev-list --count`, which INCLUDES merge commits; this read
  // excludes them, because a merge introduces no file changes of its own and would double-count
  // every file it carries. Both figures are reported so the two numbers can never drift apart
  // unexplained — a reader seeing 49 in one place and 37 in another is owed the reconciliation.
  let mergeCount = null;
  try { mergeCount = Number(git(["rev-list", "--count", "--merges", `${ref}..${head}`]).trim()); } catch { mergeCount = null; }
  let totalCount = null;
  try { totalCount = Number(git(["rev-list", "--count", `${ref}..${head}`]).trim()); } catch { totalCount = null; }

  let raw;
  try { raw = git(["log", "--no-merges", "--name-only", `--pretty=format:${REC}%H${FLD}%s`, `${ref}..${head}`]); }
  catch (err) {
    return { ok: false, class: READ_CLASSES.UNREADABLE, report: null,
      detail: `git refused the range read: ${String(err.message || err).split("\n")[0]}` };
  }

  const commits = parseNameOnlyLog(raw);
  const report = priceRange(commits);
  report.reconciliation = {
    countedHere: commits.length,
    mergeCommitsExcluded: mergeCount,
    totalIncludingMerges: totalCount,
    why: "a merge commit introduces no file changes of its own; counting it would attribute every file " +
      "it carries twice. The ledger's headline figure has always been the total including merges.",
    consistent: Number.isInteger(totalCount) && Number.isInteger(mergeCount)
      ? commits.length + mergeCount === totalCount : null,
  };
  return { ok: true, class: READ_CLASSES.OK, report, detail: `${commits.length} non-merge commit(s) of ${totalCount} read from ${ref}..${head}` };
}

/** PURE. Parse `git log --name-only --pretty=format:\x01%H\x02%s` output. */
export function parseNameOnlyLog(raw) {
  const text = String(raw || "");
  if (!text.trim()) return [];
  return text.split(REC).filter((b) => b.trim()).map((block) => {
    const nl = block.indexOf("\n");
    const headerLine = nl === -1 ? block : block.slice(0, nl);
    const body = nl === -1 ? "" : block.slice(nl + 1);
    const sep = headerLine.indexOf(FLD);
    const sha = sep === -1 ? headerLine.trim() : headerLine.slice(0, sep).trim();
    const subject = sep === -1 ? "" : headerLine.slice(sep + 1).trim();
    const files = body.split("\n").map((l) => l.trim()).filter(Boolean);
    return { sha, subject, files };
  });
}
