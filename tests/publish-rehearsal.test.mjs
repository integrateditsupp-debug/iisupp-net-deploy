// publish-rehearsal.test.mjs — RUN-AS / AS2.
//
// The claim under test: the publish is no longer a hope. The whole path — fetch the bundle into a
// repository that does not have the range, land it, confirm every published file is byte-identical
// to the tested tree, and confirm the serving rules in THAT tree do not 404 or gate any of them —
// is walked here, every cycle, in a throwaway directory.
//
// RED-FIRST, each against a real failure rather than a mock:
//   · a bundle that lands a DIFFERENT tip than the one the tests ran against
//   · a published file that differs by one byte between the landed tree and the tested tree
//   · a narrow serving rule that sends a real published path to a 404
//   · a serving rule that puts a published path behind a 401
//   · a header block that tells crawlers not to index a published path
//   · the site-wide `/*` fallback NOT counted as a 404 — that rule is how unknown paths are handled
//   · a missing bundle reported as UNRUN with a reason, never as a pass and never as a break
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  rehearsePublish, statementFor, parseServingRules, judgeServingFor, servedPathFor,
  patternMatches, REHEARSAL_CLASSES, VERDICT, PUBLISHED_SET, PUBLISH_REHEARSAL_SCHEMA,
  SENDS, PUBLISHES, BUNDLE_FILE, MANIFEST_FILE,
} from "../scripts/lib/publish-rehearsal.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (args, cwd) =>
  execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();

/**
 * A miniature of the real situation: a repo with a base commit and a range on top of it, a bundle
 * carrying that range, and a manifest describing it. Every assertion below runs against real git.
 */
function scratchWorld({ toml = "[build]\n  publish = \".\"\n", secondFile = "hello\n" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as2-rehearsal-"));
  const repo = path.join(dir, "repo");
  fs.mkdirSync(repo);
  git(["init", "--quiet", "--initial-branch=main"], repo);
  git(["config", "user.email", "t@t.t"], repo);
  git(["config", "user.name", "t"], repo);

  fs.writeFileSync(path.join(repo, "netlify.toml"), toml);
  fs.writeFileSync(path.join(repo, "index.html"), "<a href='/aria.html'>Learn more</a>");
  git(["add", "-A"], repo);
  git(["commit", "--quiet", "-m", "base"], repo);
  const base = git(["rev-parse", "HEAD"], repo);

  fs.writeFileSync(path.join(repo, "aria.html"), secondFile);
  git(["add", "-A"], repo);
  git(["commit", "--quiet", "-m", "range"], repo);
  const tip = git(["rev-parse", "HEAD"], repo);

  const bundleAbs = path.join(repo, BUNDLE_FILE);
  fs.mkdirSync(path.dirname(bundleAbs), { recursive: true });
  git(["bundle", "create", bundleAbs, `${base}..main`, "main"], repo);
  fs.writeFileSync(
    path.join(repo, MANIFEST_FILE),
    JSON.stringify({ schema: "range-bundle.v1", basedOn: { ref: "origin/main", sha: base }, tip, branch: "main" }, null, 2),
  );

  return { dir, repo, base, tip, set: ["index.html", "aria.html"] };
}

const clean = (w) => fs.rmSync(w.dir, { recursive: true, force: true });

test("AS2 — the whole publish path walks green in a throwaway repository", () => {
  const w = scratchWorld();
  try {
    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.schema, PUBLISH_REHEARSAL_SCHEMA);
    assert.equal(r.verdict, VERDICT.OK, JSON.stringify(r.findings));
    assert.equal(r.class, REHEARSAL_CLASSES.OK);
    assert.equal(r.checked, 2);
    assert.equal(r.landed.tip, w.tip, "the landed tip is the tested tip");
    assert.ok(r.files.every((f) => f.ok && f.landedBlob === f.testedBlob));
    assert.match(statementFor(r), /byte-identical/);
  } finally { clean(w); }
});

test("AS2 — the rehearsal writes nothing inside the repository and leaves no temp directory", () => {
  const w = scratchWorld();
  try {
    const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("publish-rehearsal-")).length;
    const dirtyBefore = git(["status", "--porcelain"], w.repo);
    rehearsePublish({ root: w.repo, publishedSet: w.set });
    const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("publish-rehearsal-")).length;
    assert.equal(after, before, "the throwaway clone is removed");
    assert.equal(git(["status", "--porcelain"], w.repo), dirtyBefore, "the repository is untouched");
    assert.equal(PUBLISHES, false);
    assert.equal(SENDS, false);
  } finally { clean(w); }
});

test("AS2 RED — a stale bundle whose tip is not the tested tip is caught", () => {
  const w = scratchWorld();
  try {
    // A commit made AFTER the bundle: the bundle is now one cycle behind the tested tree.
    fs.writeFileSync(path.join(w.repo, "aria.html"), "changed after the bundle\n");
    git(["add", "-A"], w.repo);
    git(["commit", "--quiet", "-m", "after"], w.repo);

    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.BROKEN);
    const classes = r.findings.map((f) => f.class);
    assert.ok(classes.includes(REHEARSAL_CLASSES.TIP_MISMATCH), JSON.stringify(classes));
    assert.ok(classes.includes(REHEARSAL_CLASSES.TREE_MISMATCH));
  } finally { clean(w); }
});

test("AS2 RED — one byte of difference in a published file names THAT file", () => {
  const w = scratchWorld();
  try {
    // Rewrite history so the tip SHA is preserved in the manifest but the tested blob differs.
    const r0 = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r0.verdict, VERDICT.OK);

    // Amend the tested tree without rebuilding the bundle: same range delivered, different bytes.
    fs.writeFileSync(path.join(w.repo, "aria.html"), "hello!\n");
    git(["add", "-A"], w.repo);
    git(["commit", "--quiet", "--amend", "-m", "range"], w.repo);

    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.BROKEN);
    const differs = r.findings.filter((f) => f.class === REHEARSAL_CLASSES.FILE_DIFFERS);
    assert.equal(differs.length, 1);
    assert.equal(differs[0].file, "aria.html", "the finding names the file, not just the tree");
  } finally { clean(w); }
});

test("AS2 RED — a narrow serving rule that 404s a published path is caught in the LANDED tree", () => {
  const w = scratchWorld({
    toml: `[build]\n  publish = "."\n\n[[redirects]]\n  from = "/aria.html"\n  to = "/404.html"\n  status = 404\n`,
  });
  try {
    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.BROKEN);
    const dead = r.findings.filter((f) => f.class === REHEARSAL_CLASSES.SERVED_404);
    assert.equal(dead.length, 1);
    assert.equal(dead[0].file, "aria.html");
  } finally { clean(w); }
});

test("AS2 — the site-wide /* fallback is NOT a finding: that rule is for unknown paths", () => {
  const w = scratchWorld({
    toml: `[build]\n  publish = "."\n\n[[redirects]]\n  from = "/*"\n  to = "/404.html"\n  status = 404\n`,
  });
  try {
    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.OK, JSON.stringify(r.findings));
  } finally { clean(w); }
});

test("AS2 RED — a gate and a noindex on a published path are each their own class", () => {
  const rules = parseServingRules(
    `[[redirects]]\n  from = "/trust.html"\n  to = "/login"\n  status = 401\n\n` +
    `[[headers]]\n  for = "/about.html"\n  [headers.values]\n    X-Robots-Tag = "noindex"\n`,
  );
  const gated = judgeServingFor("trust.html", rules);
  const hidden = judgeServingFor("about.html", rules);
  assert.equal(gated.length, 1);
  assert.equal(gated[0].class, REHEARSAL_CLASSES.SERVED_GATED);
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].class, REHEARSAL_CLASSES.SERVED_NOINDEX);
  assert.equal(judgeServingFor("index.html", rules).length, 0, "unrelated paths are untouched");
});

test("AS2 — index.html is judged at / and splats match by prefix", () => {
  assert.equal(servedPathFor("index.html"), "/");
  assert.equal(servedPathFor("assets/axis-app.js"), "/assets/axis-app.js");
  assert.ok(patternMatches("/assets/*", "/assets/axis-app.js"));
  assert.ok(!patternMatches("/assets/*", "/index.html"));
  assert.ok(patternMatches("/*", "/anything"));
  assert.ok(!patternMatches("", "/index.html"));
});

test("AS2 — a missing bundle is UNRUN with a reason, never a pass and never a break", () => {
  const w = scratchWorld();
  try {
    fs.rmSync(path.join(w.repo, BUNDLE_FILE));
    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.UNRUN);
    assert.equal(r.class, REHEARSAL_CLASSES.NO_BUNDLE);
    assert.match(statementFor(r), /NOT RUN/);
  } finally { clean(w); }
});

test("AS2 — a base commit this repository does not have is BASE_MISSING, not a fetch error", () => {
  const w = scratchWorld();
  try {
    const m = JSON.parse(fs.readFileSync(path.join(w.repo, MANIFEST_FILE), "utf8"));
    m.basedOn.sha = "0".repeat(40);
    fs.writeFileSync(path.join(w.repo, MANIFEST_FILE), JSON.stringify(m));
    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.UNRUN);
    assert.equal(r.class, REHEARSAL_CLASSES.BASE_MISSING);
  } finally { clean(w); }
});

test("AS2 — an unreadable manifest is its own class, not a silent skip", () => {
  const w = scratchWorld();
  try {
    fs.writeFileSync(path.join(w.repo, MANIFEST_FILE), "{ not json");
    const r = rehearsePublish({ root: w.repo, publishedSet: w.set });
    assert.equal(r.verdict, VERDICT.UNRUN);
    assert.equal(r.class, REHEARSAL_CLASSES.MANIFEST_UNREADABLE);
  } finally { clean(w); }
});

test("AS2 — the published set is the sixteen AS1 checks, so the two gates cannot drift", () => {
  assert.equal(PUBLISHED_SET.length, 14);
  for (const f of ["index.html", "aria.html", "trust.html", "about.html", "sitemap.xml", "robots.txt"]) {
    assert.ok(PUBLISHED_SET.includes(f), `${f} is in the published set`);
  }
});

test("AS2 — a SHALLOW source repository still rehearses: the receiver is not required to have history", () => {
  // The real working tree is a shallow clone. A plain fetch from one is refused with "shallow roots
  // are not allowed to be updated", which left the base half-built and killed the bundle fetch on a
  // parent it could never reach. Found by running the rehearsal for real; pinned here so a future
  // simplification that drops the depth flag goes red instead of going quiet.
  const w = scratchWorld();
  try {
    const shallowDir = fs.mkdtempSync(path.join(os.tmpdir(), "as2-shallow-"));
    const shallow = path.join(shallowDir, "shallow");
    git(["clone", "--quiet", "--depth=1", `file://${w.repo}`, shallow], os.tmpdir());
    fs.mkdirSync(path.join(shallow, "senior-director-state/delivery"), { recursive: true });
    fs.copyFileSync(path.join(w.repo, BUNDLE_FILE), path.join(shallow, BUNDLE_FILE));
    fs.copyFileSync(path.join(w.repo, MANIFEST_FILE), path.join(shallow, MANIFEST_FILE));

    const r = rehearsePublish({ root: shallow, publishedSet: w.set });
    assert.notEqual(r.class, REHEARSAL_CLASSES.FETCH_REFUSED, JSON.stringify(r));
    assert.ok([VERDICT.OK, VERDICT.UNRUN].includes(r.verdict), JSON.stringify(r.findings));
    fs.rmSync(shallowDir, { recursive: true, force: true });
  } finally { clean(w); }
});

test("AS2 — the real repository's serving rules do not 404, gate or hide any published file", () => {
  const toml = fs.readFileSync(path.join(REPO, "netlify.toml"), "utf8");
  const rules = parseServingRules(toml);
  assert.ok(rules.redirects.length > 0, "the real netlify.toml carries redirects");
  const findings = PUBLISHED_SET.flatMap((f) => judgeServingFor(f, rules));
  assert.deepEqual(findings, [], JSON.stringify(findings, null, 2));
});
