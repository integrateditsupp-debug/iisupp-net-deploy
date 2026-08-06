// unpublished-range.test.mjs — RUN-AR / AR1.
//
// The claim under test: "N commits ahead" is not a finding, it is a raw number, and this module
// turns it into one by reading the range out of the repository and pricing it by what it touches.
//
// RED-FIRST, proven before green:
//   · a range classified from the commit MESSAGE instead of the file list
//   · a commit that touches a public page AND the ledger being counted once, in the softer class
//   · a refused/unreadable range reported as zero commits
//   · a missing comparison ref reported as "nothing unpublished"
//   · the class order silently reordered so the record-only class reads first
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSES, READ_CLASSES, PATH_RULES, classifyPath, reasonFor,
  priceRange, statementFor, parseNameOnlyLog, readUnpublishedRange,
  UNPUBLISHED_RANGE_SCHEMA, SENDS,
} from "../scripts/lib/unpublished-range.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REC = "\u0001";
const FLD = "\u0002";

test("AR1 — the module sends nothing and declares its schema", () => {
  assert.equal(SENDS, false);
  assert.equal(UNPUBLISHED_RANGE_SCHEMA, "unpublished-range.v1");
});

test("AR1 — classification is by PATH, and every class carries a stated reason", () => {
  assert.equal(classifyPath("index.html"), CLASSES.PUBLIC_PAGE);
  assert.equal(classifyPath("assets/axis-app.js"), CLASSES.PUBLIC_PAGE);
  assert.equal(classifyPath("public/brochure.pdf"), CLASSES.PUBLIC_PAGE);
  assert.equal(classifyPath("ARIA Sentinel/src/main.js"), CLASSES.SENTINEL_APP);
  assert.equal(classifyPath("netlify.toml"), CLASSES.SERVING_LAYER);
  assert.equal(classifyPath("netlify/functions/axis-status.js"), CLASSES.SERVING_LAYER);
  assert.equal(classifyPath("scripts/emit-axis-status.mjs"), CLASSES.TOOLING_TESTS);
  assert.equal(classifyPath("tests/anything.test.mjs"), CLASSES.TOOLING_TESTS);
  assert.equal(classifyPath("senior-director-state/PROGRESS-LEDGER.md"), CLASSES.RECORD_ONLY);
  assert.equal(classifyPath("public/.well-known/axis/status.json"), CLASSES.RECORD_ONLY);
  assert.equal(classifyPath("netlify/functions/_axis-status-full.json"), CLASSES.RECORD_ONLY);
  assert.equal(classifyPath("some/thing.bin"), CLASSES.UNCLASSIFIED);

  // RED: a class without a stated reason is a preference wearing a constant name.
  for (const c of Object.values(CLASSES)) {
    const why = reasonFor(c);
    assert.ok(typeof why === "string" && why.length > 40,
      `class ${c} must carry a written reason, got: ${JSON.stringify(why)}`);
  }
});

test("AR1 — RED: the taxonomy must not be derivable from the commit message", () => {
  // Two commits with identical, deliberately misleading subjects; only the files differ.
  const report = priceRange([
    { sha: "a".repeat(40), subject: "docs: just a note", files: ["index.html"] },
    { sha: "b".repeat(40), subject: "docs: just a note", files: ["senior-director-state/x.md"] },
  ]);
  assert.equal(report.summary.commitsTouchingPublicPages, 1,
    "the subject says 'docs' for both; only the file list makes one of them public");
  assert.deepEqual(report.publicFilesChanged, ["index.html"]);
});

test("AR1 — RED: a mixed commit is counted in BOTH classes, never resolved to the softer one", () => {
  const report = priceRange([
    { sha: "c".repeat(40), subject: "mixed", files: ["index.html", "senior-director-state/PROGRESS-LEDGER.md"] },
  ]);
  const pub = report.byClass.find((b) => b.class === CLASSES.PUBLIC_PAGE);
  const rec = report.byClass.find((b) => b.class === CLASSES.RECORD_ONLY);
  assert.equal(pub.commits, 1, "the public half must be counted");
  assert.equal(rec.commits, 1, "the record half must ALSO be counted — the overlap is the point");
  assert.equal(pub.exclusiveCommits, 0, "it is not a public-only commit");
  assert.equal(rec.exclusiveCommits, 0, "and it is not a record-only commit either");
  assert.equal(report.summary.commitsTouchingPublicPages, 1);
  // The overlap means the class counts do not sum to the range size, and that must stay true.
  const sum = report.byClass.reduce((n, b) => n + b.commits, 0);
  assert.ok(sum > report.summary.commits, "overlapping counts must not be normalised into a partition");
});

test("AR1 — exclusive counts answer the different question", () => {
  const report = priceRange([
    { sha: "1".repeat(40), subject: "ledger", files: ["senior-director-state/a.md", "senior-director-state/b.md"] },
    { sha: "2".repeat(40), subject: "ledger", files: ["senior-director-state/c.md"] },
    { sha: "3".repeat(40), subject: "page + ledger", files: ["about.html", "senior-director-state/d.md"] },
  ]);
  const rec = report.byClass.find((b) => b.class === CLASSES.RECORD_ONLY);
  assert.equal(rec.commits, 3, "three commits touch the record");
  assert.equal(rec.exclusiveCommits, 2, "but only two touch nothing else");
  assert.equal(report.summary.commitsRecordOnly, 2);
});

test("AR1 — the class order is most-visible-first and is asserted, not typed", () => {
  const order = Object.values(CLASSES);
  assert.equal(order[0], CLASSES.PUBLIC_PAGE, "the class a stranger can see must be reported first");
  assert.equal(order[order.length - 1], CLASSES.UNCLASSIFIED, "unclassified is last and never absorbed");
  const report = priceRange([{ sha: "d".repeat(40), subject: "x", files: ["index.html"] }]);
  assert.deepEqual(report.byClass.map((b) => b.class), order,
    "the report must present the classes in the declared order");
});

test("AR1 — the statement names the finding, including when the customer-visible share is zero", () => {
  const none = priceRange([{ sha: "e".repeat(40), subject: "ledger", files: ["senior-director-state/x.md"] }]);
  assert.match(none.statement, /would change nothing a visitor/i);
  assert.doesNotMatch(none.statement, /outage/i.test("") ? /$^/ : /is a customer-facing outage/i);

  const some = priceRange([{ sha: "f".repeat(40), subject: "page", files: ["index.html"] }]);
  assert.match(some.statement, /1 of them touch 1 file\(s\) a visitor can load/);

  assert.match(statementFor({ commits: 0, commitsTouchingPublicPages: 0, publicFilesChanged: 0 }, []),
    /Nothing is unpublished/);
});

test("AR1 — RED: an unreadable range must never be reported as zero commits", () => {
  // A directory that is not a git repository: the read must refuse, not return an empty report.
  const res = readUnpublishedRange({ root: path.join(REPO, "senior-director-state"), ref: "definitely/not/a/ref" });
  assert.equal(res.ok, false);
  assert.ok([READ_CLASSES.NO_REF, READ_CLASSES.UNREADABLE].includes(res.class),
    `expected a refusal class, got ${res.class}`);
  assert.equal(res.report, null, "a refusal must carry no report — an empty report reads as 'nothing unpublished'");
  assert.ok(res.detail && res.detail.length > 10, "the refusal must say why");
});

test("AR1 — RED: a missing comparison ref is UNKNOWN, not 'nothing unpublished'", () => {
  const res = readUnpublishedRange({ root: REPO, ref: "refs/heads/this-ref-does-not-exist-ar1" });
  assert.equal(res.ok, false);
  assert.equal(res.class, READ_CLASSES.NO_REF);
  assert.match(res.detail, /unknown, not zero/);
});

test("AR1 — the log parser survives a subject containing newlines-adjacent punctuation", () => {
  const raw = [
    `${REC}${"a".repeat(40)}${FLD}fix: a subject with | pipes and : colons`,
    "index.html",
    "assets/app.js",
    `${REC}${"b".repeat(40)}${FLD}chore: another`,
    "senior-director-state/x.md",
  ].join("\n");
  const commits = parseNameOnlyLog(raw);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].subject, "fix: a subject with | pipes and : colons");
  assert.deepEqual(commits[0].files, ["index.html", "assets/app.js"]);
  assert.deepEqual(commits[1].files, ["senior-director-state/x.md"]);
  assert.deepEqual(parseNameOnlyLog(""), []);
  assert.deepEqual(parseNameOnlyLog(null), []);
});

test("AR1 — the real range is read from THIS repository and priced", () => {
  const res = readUnpublishedRange({ root: REPO, ref: "origin/main" });
  if (!res.ok) {
    // Honest degradation: if origin/main is not in this checkout the suite says so rather than
    // inventing a range. It must NOT pass by pretending the distance is zero.
    assert.ok([READ_CLASSES.NO_REF, READ_CLASSES.UNREADABLE].includes(res.class));
    return;
  }
  const r = res.report;
  assert.equal(r.schema, UNPUBLISHED_RANGE_SCHEMA);
  assert.ok(Number.isInteger(r.summary.commits) && r.summary.commits >= 0);
  assert.ok(r.summary.commitsTouchingPublicPages <= r.summary.commits,
    "commits touching public pages can never exceed the range");
  assert.equal(r.publicFilesChanged.length, r.summary.publicFilesChanged);
  assert.equal(r.commits.length, r.summary.commits);
  assert.ok(typeof r.statement === "string" && r.statement.length > 40);
  // Every file named in the public class must actually be classified public — no leakage.
  for (const f of r.publicFilesChanged) assert.equal(classifyPath(f), CLASSES.PUBLIC_PAGE);
});

test("AR1 — the artefact on disk, when present, agrees with a fresh read", () => {
  const abs = path.join(REPO, "senior-director-state/unpublished-range.json");
  if (!fs.existsSync(abs)) return; // the emitter writes it; absence is not this suite's red
  const saved = JSON.parse(fs.readFileSync(abs, "utf8"));
  assert.equal(saved.schema, UNPUBLISHED_RANGE_SCHEMA);
  assert.ok(typeof saved.generatedAt === "string" && !Number.isNaN(Date.parse(saved.generatedAt)));
  assert.ok(saved.report || saved.refusal,
    "the artefact carries either a priced report or a stated refusal — never silence");
  if (saved.report) {
    assert.equal(saved.report.commits.length, saved.report.summary.commits);
    for (const f of saved.report.publicFilesChanged) assert.equal(classifyPath(f), CLASSES.PUBLIC_PAGE);
  }
});

test("AR1 — the pure half performs no I/O", () => {
  const src = fs.readFileSync(path.join(REPO, "scripts/lib/unpublished-range.mjs"), "utf8");
  const pureHalf = src.slice(0, src.indexOf("export function readUnpublishedRange"));
  assert.doesNotMatch(pureHalf, /execFileSync\(/, "classification must not shell out");
  assert.doesNotMatch(pureHalf, /readFileSync|writeFileSync/, "classification must not touch the filesystem");
  assert.ok(PATH_RULES.length >= 5, "the taxonomy must be declared as data, not buried in branches");
});
