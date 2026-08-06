// publish-rehearsal.mjs — RUN-AS / AS2. THE PUBLISH, WALKED END TO END BEFORE IT IS ASKED FOR.
//
// WHY THIS EXISTS (2026-08-06).
// AR2 built the credential-free delivery path: a verified git bundle that carries the unpublished
// range as a single file. What AR2 proved is that the bundle is INTACT — the bytes are all there,
// the tip is the commit the tests ran against, the tree at that tip is the tree that was tested.
// What nobody had done is walk the rest of the path: fetch that bundle into a repository that does
// not have the range, land it, and then look at what a visitor would actually be served.
//
// "It will publish cleanly" has been an assumption for twenty-four cycles. An assumption that has
// never been executed is a hope with a schedule. This makes it a test that runs every cycle.
//
// WHAT IT PROVES, each with its own failure class so a red says which step broke:
//
//   1. THE FETCH WORKS AT ALL, with no network and no credential. A fresh repository holding only
//      the base commit fetches the bundle from a file path and gains the range.
//   2. THE LANDED TIP IS THE TESTED TIP. Not "a recent commit" — the SHA the suite was green
//      against. A bundle can be perfectly intact and still be one cycle stale, which is the exact
//      state that publishes work nobody tested.
//   3. THE LANDED TREE IS THE TESTED TREE. The commit SHA can be right and the tree still be
//      something no test ever saw if the record was written by hand. The tree hash is what a
//      checkout actually produces, so the tree hash is what is compared.
//   4. EVERY PUBLISHED FILE IS BYTE-IDENTICAL. Per file, per blob hash. A tree-level match already
//      implies this, but a per-file check is what names the file when it does not — and naming the
//      file is the difference between a red that is actionable and a red that starts an
//      investigation.
//   5. THE SERVING LAYER IN THAT SAME TREE DOES NOT 404 OR GATE ANY OF THEM. This is the step the
//      other four cannot see. A file can be present, correct and byte-identical in the tree and
//      still be unreachable, because `netlify.toml` in that same tree redirects its path to a 404,
//      forces a login on it, or tells crawlers not to index it. The serving rules are read FROM THE
//      LANDED TREE rather than from the working copy on purpose: the working copy is not what gets
//      published, and a rule that only exists locally would certify a publish that behaves
//      differently the moment it is live.
//
// WHAT IT REFUSES TO DO. It does not publish. It does not reach a network. It does not write inside
// the repository — the whole rehearsal happens in a throwaway directory under the OS temp root that
// is removed whether the rehearsal passes or fails. The irreversible step stays Ahmad's; this only
// removes the excuse that nobody knows whether it would work.
//
// REAL-OR-EMPTY. A rehearsal that could not run — no bundle on disk, no manifest, git refused the
// fetch — is reported as UNRUN with the reason. It is never reported as a pass, and it is never
// reported as a failure of the publish either, because "we could not check" and "it is broken" are
// different facts and collapsing them is how a program learns to distrust its own greens.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PUBLISH_REHEARSAL_SCHEMA = "publish-rehearsal.v1";
export const SENDS = false;
export const PUBLISHES = false;
export const WRITES_IN_REPO = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNRUN: "unrun" });

export const REHEARSAL_CLASSES = Object.freeze({
  OK: "publish-rehearsed-end-to-end-and-every-published-file-is-reachable",
  NO_BUNDLE: "no-bundle-on-disk-so-the-publish-path-could-not-be-walked",
  NO_MANIFEST: "no-manifest-on-disk-so-nothing-could-be-compared-against",
  MANIFEST_UNREADABLE: "manifest-is-not-readable-json",
  BASE_MISSING: "the-base-commit-the-bundle-builds-on-is-not-in-this-repository",
  FETCH_REFUSED: "git-refused-to-fetch-the-bundle-into-a-fresh-repository",
  TIP_MISMATCH: "the-landed-tip-is-not-the-commit-the-tests-ran-against",
  TREE_MISMATCH: "the-landed-tree-is-not-the-tree-the-tests-ran-against",
  FILE_MISSING: "a-published-file-is-absent-from-the-landed-tree",
  FILE_DIFFERS: "a-published-file-in-the-landed-tree-is-not-byte-identical-to-the-tested-one",
  SERVED_404: "a-serving-rule-in-the-landed-tree-sends-a-published-path-to-a-404",
  SERVED_GATED: "a-serving-rule-in-the-landed-tree-puts-a-published-path-behind-a-gate",
  SERVED_NOINDEX: "a-serving-rule-in-the-landed-tree-tells-crawlers-not-to-index-a-published-path",
  NO_SERVING_CONFIG: "the-landed-tree-carries-no-netlify-toml-so-serving-rules-are-unreadable",
});

export const BUNDLE_FILE = "senior-director-state/delivery/unpublished-line.bundle";
export const MANIFEST_FILE = "senior-director-state/delivery/unpublished-line.manifest.json";

/** The set a stranger loads. Kept in one place with AS1 so the two gates cannot drift apart. */
export const PUBLISHED_SET = Object.freeze([
  "index.html", "aria.html", "trust.html", "about.html",
  "ai-edge.html", "growth-library.html", "health-check.html", "scorecard.html",
  "sitemap.xml", "robots.txt",
  "assets/axis-app.js", "assets/axis-tokens.css", "assets/axis-state.json",
  "assets/aperture-learning.js",
]);

/** Statuses that mean "the reader does not get the file". */
export const DEAD_STATUSES = Object.freeze(new Set([404, 410, 451]));
/** Statuses that mean "the reader is stopped and asked for something first". */
export const GATE_STATUSES = Object.freeze(new Set([401, 403]));

function git(args, { cwd, allowFail = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" },
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

/**
 * Parse the `[[redirects]]` blocks out of a netlify.toml. Deliberately a small, explicit reader
 * rather than a TOML dependency: the only shapes that matter here are `from`, `to`, `status`,
 * `force`, and the `[[headers]]` `for` + values. A full parser would read more and prove less.
 */
export function parseServingRules(toml = "") {
  const redirects = [];
  const headers = [];
  let block = null;

  for (const rawLine of String(toml).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line === "[[redirects]]") {
      block = { kind: "redirect", from: null, to: null, status: 200, force: false };
      redirects.push(block);
      continue;
    }
    if (line === "[[headers]]") {
      block = { kind: "header", for: null, values: {} };
      headers.push(block);
      continue;
    }
    if (line.startsWith("[") && line !== "[headers.values]") { block = null; continue; }
    if (!block) continue;

    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim().replace(/^["']|["']$/g, "");

    if (block.kind === "redirect") {
      if (key === "from") block.from = value;
      else if (key === "to") block.to = value;
      else if (key === "status") block.status = Number.parseInt(value, 10) || 200;
      else if (key === "force") block.force = value === "true";
    } else if (block.kind === "header") {
      if (key === "for") block.for = value;
      else block.values[key] = value;
    }
  }
  return { redirects, headers };
}

/** Netlify path patterns are literal with a trailing `/*` splat. Nothing else is supported here. */
export function patternMatches(pattern = "", urlPath = "") {
  if (!pattern) return false;
  const p = pattern.startsWith("/") ? pattern : `/${pattern}`;
  const u = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  if (p === "/*") return true;
  if (p.endsWith("/*")) return u.startsWith(p.slice(0, -1));
  return p === u;
}

/** The URL a published repo file is served at. `index.html` is the root document. */
export function servedPathFor(file = "") {
  if (file === "index.html") return "/";
  return `/${file}`;
}

/**
 * Judge the serving rules against one published path. Returns [] when the reader gets the file.
 * The `/*` catch-all is exempted from the dead/gate check on purpose: a site-wide `/* -> /404.html`
 * fallback is how a static host handles UNKNOWN paths, and it never applies to a file that exists.
 * A NARROWER rule pointing a real path at a 404 is a different thing entirely, and that is what
 * this catches.
 */
export function judgeServingFor(file, rules) {
  const urlPath = servedPathFor(file);
  const findings = [];

  for (const r of rules.redirects || []) {
    if (r.from === "/*") continue;
    if (!patternMatches(r.from, urlPath)) continue;
    if (DEAD_STATUSES.has(r.status)) {
      findings.push({ file, urlPath, class: REHEARSAL_CLASSES.SERVED_404, rule: `${r.from} -> ${r.to} (${r.status})` });
    } else if (GATE_STATUSES.has(r.status)) {
      findings.push({ file, urlPath, class: REHEARSAL_CLASSES.SERVED_GATED, rule: `${r.from} -> ${r.to} (${r.status})` });
    }
  }

  for (const h of rules.headers || []) {
    if (!patternMatches(h.for, urlPath)) continue;
    const robots = h.values["X-Robots-Tag"] || h.values["x-robots-tag"];
    if (robots && /noindex|none/i.test(robots)) {
      findings.push({ file, urlPath, class: REHEARSAL_CLASSES.SERVED_NOINDEX, rule: `${h.for} X-Robots-Tag: ${robots}` });
    }
    const auth = h.values["WWW-Authenticate"] || h.values["Basic-Auth"] || h.values["basic_auth"];
    if (auth) {
      findings.push({ file, urlPath, class: REHEARSAL_CLASSES.SERVED_GATED, rule: `${h.for} ${auth}` });
    }
  }

  return findings;
}

function unrun(cls, detail) {
  return {
    schema: PUBLISH_REHEARSAL_SCHEMA,
    verdict: VERDICT.UNRUN,
    class: cls,
    detail,
    checked: 0,
    files: [],
    findings: [],
    landed: null,
  };
}

/**
 * Walk the whole publish path in a throwaway clone.
 *
 * @param {object} opts
 * @param {string} opts.root       repository root (the one holding the bundle + the tested tree)
 * @param {string} [opts.expectTip] the commit the tests ran against; defaults to the repo's HEAD
 * @param {string[]} [opts.publishedSet]
 * @returns {object} report — never throws for an expected failure; expected failures are verdicts
 */
export function rehearsePublish({ root = process.cwd(), expectTip = null, publishedSet = PUBLISHED_SET } = {}) {
  const bundleAbs = path.join(root, BUNDLE_FILE);
  const manifestAbs = path.join(root, MANIFEST_FILE);

  if (!fs.existsSync(bundleAbs)) return unrun(REHEARSAL_CLASSES.NO_BUNDLE, BUNDLE_FILE);
  if (!fs.existsSync(manifestAbs)) return unrun(REHEARSAL_CLASSES.NO_MANIFEST, MANIFEST_FILE);

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestAbs, "utf8"));
  } catch (err) {
    return unrun(REHEARSAL_CLASSES.MANIFEST_UNREADABLE, String(err.message || err));
  }

  const baseSha = manifest?.basedOn?.sha;
  const branch = manifest?.branch || "main";
  const tip = expectTip || git(["rev-parse", "HEAD"], { cwd: root, allowFail: true });
  if (!baseSha) return unrun(REHEARSAL_CLASSES.MANIFEST_UNREADABLE, "manifest carries no basedOn.sha");

  const baseType = git(["cat-file", "-t", baseSha], { cwd: root, allowFail: true });
  if (baseType !== "commit") return unrun(REHEARSAL_CLASSES.BASE_MISSING, baseSha);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "publish-rehearsal-"));
  const findings = [];
  const files = [];
  let landed = null;

  try {
    // The initial branch is deliberately a name NOTHING is fetched into. git refuses to fetch into
    // the branch a non-bare repository currently has checked out, so a receiver repo whose HEAD
    // happened to be `base` or `main` would fail on the first step for a reason that has nothing to
    // do with the publish. Found on the first run, fixed here rather than worked around in the test.
    git(["init", "--quiet", "--initial-branch=rehearsal-scratch", tmp], { cwd: os.tmpdir() });
    // The fresh repository is given ONLY the base commit — exactly the state a receiver is in.
    //
    // `--depth=1` is not an optimisation. This working tree is a SHALLOW clone, and a plain fetch
    // from a shallow source refuses with "shallow roots are not allowed to be updated", leaves the
    // base half-built, and the bundle fetch then dies traversing parents it can never reach. The
    // first real run of this rehearsal is what surfaced it; the fix is recorded here rather than
    // patched around in the test, because a rehearsal that only passes against a full clone would
    // certify a publish path this environment cannot actually walk.
    git(["fetch", "--quiet", "--depth=1", root, `${baseSha}:refs/heads/base`], { cwd: tmp });

    const landedRef = `refs/heads/from-bundle`;
    const fetched = git(["fetch", bundleAbs, `${branch}:${landedRef}`], { cwd: tmp, allowFail: true });
    if (fetched === null) {
      return { ...unrun(REHEARSAL_CLASSES.FETCH_REFUSED, `git refused to fetch ${BUNDLE_FILE}`), verdict: VERDICT.BROKEN };
    }

    const landedTip = git(["rev-parse", landedRef], { cwd: tmp, allowFail: true });
    const landedTree = landedTip ? git(["rev-parse", `${landedRef}^{tree}`], { cwd: tmp, allowFail: true }) : null;
    landed = { tip: landedTip, tree: landedTree, expectedTip: tip };

    const testedTree = tip ? git(["rev-parse", `${tip}^{tree}`], { cwd: root, allowFail: true }) : null;

    if (tip && landedTip !== tip) {
      findings.push({
        class: REHEARSAL_CLASSES.TIP_MISMATCH,
        detail: `landed ${landedTip} · tested ${tip}`,
      });
    }
    if (testedTree && landedTree !== testedTree) {
      findings.push({
        class: REHEARSAL_CLASSES.TREE_MISMATCH,
        detail: `landed ${landedTree} · tested ${testedTree}`,
      });
    }

    // Per file, per blob hash. Names the file rather than only the tree.
    for (const file of publishedSet) {
      const landedBlob = git(["rev-parse", `${landedRef}:${file}`], { cwd: tmp, allowFail: true });
      const testedBlob = tip ? git(["rev-parse", `${tip}:${file}`], { cwd: root, allowFail: true }) : null;
      const row = { file, landedBlob, testedBlob, ok: false };
      if (!landedBlob) {
        findings.push({ file, class: REHEARSAL_CLASSES.FILE_MISSING, detail: "absent from the landed tree" });
      } else if (testedBlob && landedBlob !== testedBlob) {
        findings.push({ file, class: REHEARSAL_CLASSES.FILE_DIFFERS, detail: `${landedBlob} != ${testedBlob}` });
      } else {
        row.ok = true;
      }
      files.push(row);
    }

    // The serving layer, read out of the LANDED tree — not the working copy.
    const toml = git(["show", `${landedRef}:netlify.toml`], { cwd: tmp, allowFail: true });
    if (toml === null) {
      findings.push({ class: REHEARSAL_CLASSES.NO_SERVING_CONFIG, detail: "netlify.toml not in the landed tree" });
    } else {
      const rules = parseServingRules(toml);
      for (const file of publishedSet) findings.push(...judgeServingFor(file, rules));
    }
  } catch (err) {
    return { ...unrun(REHEARSAL_CLASSES.FETCH_REFUSED, String(err.message || err)), verdict: VERDICT.BROKEN, landed };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return {
    schema: PUBLISH_REHEARSAL_SCHEMA,
    verdict: findings.length === 0 ? VERDICT.OK : VERDICT.BROKEN,
    class: findings.length === 0 ? REHEARSAL_CLASSES.OK : findings[0].class,
    detail: findings.length === 0 ? `${files.length} published files land byte-identical and are served` : findings[0].detail || "",
    checked: files.length,
    files,
    findings,
    landed,
    publishes: PUBLISHES,
  };
}

/** One honest sentence for the feed. Never claims a pass it did not run. */
export function statementFor(report) {
  if (!report) return "publish rehearsal: not run";
  if (report.verdict === VERDICT.UNRUN) return `publish rehearsal: NOT RUN — ${report.class} (${report.detail})`;
  if (report.verdict === VERDICT.OK) {
    return `publish rehearsal: ${report.checked} published files fetched from the bundle into a fresh repository, byte-identical to the tested tree, and served without a 404 or a gate`;
  }
  return `publish rehearsal: BROKEN — ${report.findings.length} finding(s), first: ${report.findings[0].class}`;
}

export default { rehearsePublish, statementFor, parseServingRules, judgeServingFor, servedPathFor, patternMatches, REHEARSAL_CLASSES, VERDICT, PUBLISHED_SET };
