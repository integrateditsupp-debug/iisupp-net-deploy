#!/usr/bin/env node
// tests/plumbing-commit-denylist.test.mjs — RUN-BA / BA0.
//
// THE DEFECT THIS SUITE EXISTS FOR, STATED PLAINLY.
//
// RUN-AZ closed reporting "1063/1063 · 371/371 · exit 0 after every write". The sentence was true of
// every write except the last one. Its final two commits — `34d8ef8` (ledger head, truth artefact,
// delivery bundle) and `0f6cb80` (queue, run files) — named ten `senior-director-state/` paths as
// `--file` arguments to the plumbing committer. The committer added them without objection. The
// registry was not re-read afterwards, because the cycle was over.
//
// The result: ten internal paths tracked at HEAD in a repository whose publish dir is ".", which is
// to say ten internal paths in every clone and in the live deploy. `deploy-safety-denylist` found
// them on the next arrival, which is exactly what it is for and exactly one cycle too late.
//
// A check that runs after the irreversible act is a smoke alarm in the car park. So the refusal
// moved INTO the committer, and this suite proves the refusal rather than trusting it: each class is
// asserted by handing the committer the exact path that must be refused and requiring it to throw
// BY NAME, and by handing it a legitimate path and requiring it to proceed. A gate that refuses
// everything is not a gate.
//
// Nothing here writes to the real repository: every call is `dryRun`, and the refusal cases throw
// before any index is created at all.

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);

const { plumbingCommit } = await load("scripts/plumbing-commit.mjs");
const { denylistViolation, denylistViolations, DENY_PREFIXES, SENTINEL_PREFIX } = await load("scripts/lib/deploy-denylist.mjs");

// ── 1. THE EXACT TEN. Not a representative sample — the literal paths RUN-AZ committed, so this
// suite goes red the day any one of them becomes committable again.
const THE_DENIED_PREFIX = DENY_PREFIXES.find((p) => p.startsWith("senior"));
const THE_TEN_THAT_LEAKED = [
  "senior-director-state/Live-Operations-Log.md",
  "senior-director-state/PROGRESS-LEDGER.md",
  "senior-director-state/cc-runs/RUN-AZ-the-customer-who-stops-answering.md",
  "senior-director-state/cc-runs/RUN-BA-the-event-nobody-kept.md",
  "senior-director-state/codex-claude-queue.md",
  "senior-director-state/delivery/unpublished-line.bundle",
  "senior-director-state/delivery/unpublished-line.manifest.json",
  "senior-director-state/program-truth.json",
  "senior-director-state/sandbox-git-boundary.json",
  "senior-director-state/unpublished-range.json",
];

test("the ten paths RUN-AZ actually committed are each refused, by name", () => {
  for (const file of THE_TEN_THAT_LEAKED) {
    const v = denylistViolation(file);
    assert.ok(v, `${file} — the path that leaked reads as clean; this is the regression itself`);
    // The rule is compared against the IMPORTED prefix, never a second copy of the string: one
    // vocabulary is the whole point, and a literal here would be the drift this module prevents.
    assert.ok(v.rule.includes(THE_DENIED_PREFIX), `${file} — refused, but not for the reason that actually applies`);
  }
  assert.equal(denylistViolations(THE_TEN_THAT_LEAKED).length, 10, "every one of the ten, never a subset");
});

// Selected out of the list above rather than retyped: a second literal is a second thing to get wrong,
// and record-dependency-declared reads a token on a CALLING line as a real dependency (correctly — it
// cannot tell a pure function from a filesystem one, and guessing in that direction is how invariants rot).
const THE_LEDGER_HEAD = THE_TEN_THAT_LEAKED[1];

test("the committer THROWS on a denied path rather than reporting it afterwards", () => {
  assert.throws(
    () => plumbingCommit({ message: "m", files: [THE_LEDGER_HEAD], dryRun: true }),
    (err) => {
      assert.match(err.message, /must never be tracked/, "the refusal must say what rule refused");
      assert.ok(err.message.includes(THE_LEDGER_HEAD), "the refusal must name the path");
      assert.match(err.message, /publish dir is "\."/, "the refusal must say WHY, or the next operator will bypass it");
      return true;
    },
    "the committer accepted the exact write that caused this cycle's repair"
  );
});

test("dryRun does not soften the refusal — a dry run that passes teaches the wrong lesson", () => {
  for (const dryRun of [true, false]) {
    assert.throws(
      () => plumbingCommit({ message: "m", files: ["aria-vault/CLAUDE.md"], dryRun }),
      /must never be tracked/,
      `dryRun=${dryRun} — refusal must not depend on the mode`
    );
  }
});

test("every denied prefix is refused, not just the one that happened to leak", () => {
  for (const prefix of DENY_PREFIXES) {
    const probe = `${prefix}${prefix.endsWith("/") ? "" : "/"}probe.md`;
    assert.ok(denylistViolation(probe), `${probe} — a denied prefix that does not refuse`);
    assert.throws(() => plumbingCommit({ message: "m", files: [probe], dryRun: true }), /must never be tracked/);
  }
});

test("the non-prefix classes refuse: CLAUDE.md anywhere, operator scripts, archives", () => {
  const cases = [
    ["CLAUDE.md", /CLAUDE\.md is operator instruction/],
    ["anything/nested/CLAUDE.md", /CLAUDE\.md is operator instruction/],
    ["scripts/LOOP-RUN-CC.bat", /operator script/],
    ["deploy.ps1", /operator script/],
    ["tools/thing.cmd", /operator script/],
    ["backups/site.tar.gz", /archive/],
  ];
  for (const [file, rule] of cases) {
    const v = denylistViolation(file);
    assert.ok(v, `${file} — reads as clean`);
    assert.match(v.rule, rule, `${file} — refused for the wrong reason`);
  }
});

// ── 2. THE GATE MUST NOT REFUSE EVERYTHING. A committer that throws on every input would make this
// suite green and the program unable to ship a line of code.
test("legitimate product paths are ACCEPTED — including the Sentinel exemption", () => {
  for (const file of [
    "assets/aperture-learning.js",
    "public/.well-known/axis/status.json",
    "tests/plumbing-commit-denylist.test.mjs",
    `${SENTINEL_PREFIX}CLAUDE.md`,          // desktop-product source, force-404'd live
    `${SENTINEL_PREFIX}scripts/build.ps1`,  // ditto — a build script INSIDE the product tree
    "backups/aria-core.js",                 // backups/ is deliberately not denied
  ]) {
    assert.equal(denylistViolation(file), false, `${file} — a legitimate path refused; the gate is too wide`);
  }
});

test("the Sentinel exemption does NOT reopen a denied prefix nested inside it", () => {
  // Order is load-bearing: prefixes are checked BEFORE the exemption. If that ever inverts, a vault
  // copied under the product tree would ship.
  const nested = `${SENTINEL_PREFIX}aria-vault/CLAUDE.md`;
  assert.equal(denylistViolation(nested), false, "documented behaviour: the prefix check runs on the full path and 'ARIA Sentinel/aria-vault/' does not start with 'aria-vault/'");
  // ...which is precisely why the exemption is narrow and this case is written down rather than
  // assumed. It is recorded as a KNOWN boundary, not asserted as safe: nothing has ever placed a
  // vault there, and the day something does, this line is where the argument gets had.
});

// ── 3. THE TWO ENFORCERS MUST NOT DRIFT. The whole point of the shared module.
test("the committer and the deploy-safety test refuse the same set, proven by running both", async () => {
  const sample = [...THE_TEN_THAT_LEAKED, "CLAUDE.md", "assets/axis-app.js", `${SENTINEL_PREFIX}CLAUDE.md`];
  const fromModule = new Set(denylistViolations(sample).map((v) => v.file));

  // The test file no longer owns a list — it imports this one. Proving that is proving they agree.
  const src = await import("node:fs").then((fs) => fs.readFileSync(path.join(repoRoot, "tests/deploy-safety-denylist.test.mjs"), "utf8"));
  assert.match(src, /deploy-denylist\.mjs/, "deploy-safety-denylist must import the shared list, not restate it");
  assert.doesNotMatch(src, /^const DENY_PREFIXES = \[/m, "a second copy of the list is how the two enforcers drift apart");

  assert.deepEqual([...fromModule].sort(), [...THE_TEN_THAT_LEAKED, "CLAUDE.md"].sort());
});

// ── 4. UNTRACKING IS `--cached` ONLY. The repair must never delete an operator's ledger from disk.
test("the untrack path is --cached only — a repair that deletes the ledger is worse than the leak", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync(path.join(repoRoot, "scripts/plumbing-commit.mjs"), "utf8"));
  const rmCall = src.match(/git\(\["rm"[^\]]*\]/);
  assert.ok(rmCall, "the committer must have an untrack path at all");
  assert.match(rmCall[0], /"--cached"/, "untracking without --cached would delete the file from Ahmad's disk (Rule 15)");
});

test("a commit naming nothing at all is still refused", () => {
  assert.throws(() => plumbingCommit({ message: "m", files: [], remove: [], dryRun: true }), /guesses its own contents/);
  assert.throws(() => plumbingCommit({ message: "", files: ["assets/axis-app.js"], dryRun: true }), /nobody can review/);
});

console.log("plumbing-commit-denylist test passed (the ten by name · committer refuses rather than reports · every prefix + non-prefix class · legitimate paths still accepted · Sentinel exemption narrow · one vocabulary two enforcers · untrack is --cached only).");
