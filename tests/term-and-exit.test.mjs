// AZ2 — the end of the term, walked as artefacts.
//
// The reds that matter defend two different lies. The first is a document counted because of its
// NAME: a file that is present, correct and silent about the stage it was listed for. The second is
// a number that agrees with itself because only one document was read.
//
// And one refusal that is not a lie but a boundary: no code path here may pick which answer is
// right. What this company commits to at the end of a term is a decision.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  auditTermAndExit,
  walkStage,
  statementFor,
  EXIT_WALK,
  TERM_TOPICS,
  STAGE,
  TERM_REGISTER,
  TERM_EXIT_SCHEMA,
} from "../scripts/lib/term-and-exit.mjs";

const root = path.resolve(import.meta.dirname, "..");

function repo(committed, uncommitted = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "term-exit-repo-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  for (const [rel, text] of Object.entries(committed)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "c");
  for (const [rel, text] of Object.entries(uncommitted)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

const REG = (rows) =>
  "| topic | state | reason | who decides |\n| --- | --- | --- | --- |\n" + rows.join("\n") + "\n";

test("AZ2 — the real tree walks clean, and nothing is sent, signed, cancelled or renewed", () => {
  const r = auditTermAndExit({ root });
  assert.equal(r.schema, TERM_EXIT_SCHEMA);
  assert.equal(r.sent, false);
  assert.equal(r.signed, false);
  assert.equal(r.cancelled, false);
  assert.equal(r.renewed, false);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AZ2 RED — a document that arrives and never mentions its stage is SILENT, not delivered", () => {
  const dir = repo({ "legal/x.md": "This agreement is about many things and none of them is leaving." });
  const s = walkStage(
    { id: "X", stage: "told about renewal", files: ["legal/x.md"], mentions: /auto-renew/i },
    { root: dir },
  );
  // The state a filename count can never see.
  assert.equal(s.rawState, STAGE.SILENT);
  assert.match(s.why, /counts filenames/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 GREEN — a document that speaks to its stage is delivered", () => {
  const dir = repo({ "legal/x.md": "It auto-renews for successive periods unless notice is given." });
  const s = walkStage(
    { id: "X", stage: "told about renewal", files: ["legal/x.md"], mentions: /auto-?renew/i },
    { root: dir },
  );
  assert.equal(s.rawState, STAGE.DELIVERED);
  assert.deepEqual(s.spokenBy, ["legal/x.md"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 RED — a stage whose document exists only in the working copy is ABSENT", () => {
  const dir = repo(
    { "legal/other.md": "x" },
    { "legal/x.md": "It auto-renews for successive periods." },
  );
  const s = walkStage(
    { id: "X", stage: "told about renewal", files: ["legal/x.md"], mentions: /auto-?renew/i },
    { root: dir },
  );
  // A clone receives nothing of it, so a customer cannot be handed it.
  assert.equal(s.rawState, STAGE.ABSENT);
  assert.match(s.why, /legal\/x\.md/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 RED — a silent stage nobody declared holds the audit red BY NAME", () => {
  const dir = repo({ "legal/x.md": "Nothing about leaving at all." });
  const r = auditTermAndExit({
    root: dir,
    walk: [{ id: "X-99", stage: "s", files: ["legal/x.md"], mentions: /auto-?renew/i }],
    topics: [],
    registerFile: "docs/NOPE.md",
  });
  assert.deepEqual(r.summary.undeclaredStages, ["X-99"]);
  assert.equal(r.summary.ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 — a declared silent stage is reported and does NOT hold the audit red", () => {
  const dir = repo({ "legal/x.md": "Nothing about leaving at all." });
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/REG.md"),
    REG([
      "| X-99 | open | What a renewal conversation contains has not been decided, and writing a clause to close this check would commit the company to terms nobody chose | Ahmad |",
    ]),
  );
  const r = auditTermAndExit({
    root: dir,
    walk: [{ id: "X-99", stage: "s", files: ["legal/x.md"], mentions: /auto-?renew/i }],
    topics: [],
    registerFile: "docs/REG.md",
  });
  assert.deepEqual(r.summary.undeclaredStages, []);
  assert.equal(r.summary.declaredStages, 1);
  assert.equal(r.summary.ok, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 RED — two documents stating different windows is a conflict naming both, undeclared goes red", () => {
  const dir = repo({
    "a.md": "Customer Data export is available for 30 days post-termination.",
    "b.md": "Customer Data export is available for 90 days post-termination.",
  });
  const r = auditTermAndExit({
    root: dir,
    walk: [],
    topics: [
      {
        topic: "export-window",
        question: "q",
        normalise: "days",
        sources: [
          { file: "a.md", re: /available for (\d+\s*days?) post-termination/i },
          { file: "b.md", re: /available for (\d+\s*days?) post-termination/i },
        ],
      },
    ],
    registerFile: "docs/NOPE.md",
  });
  assert.equal(r.summary.conflicts, 1);
  assert.deepEqual(r.summary.undeclaredConflicts, ["export-window"]);
  assert.equal(r.summary.ok, false);
  // Both citations, always — a conflict a reader cannot look up is a rumour.
  assert.deepEqual(r.topics[0].filesAnswering.sort(), ["a.md", "b.md"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 — no code path resolves a disagreement; the module says so about itself", () => {
  const dir = repo({
    "a.md": "Customer Data export is available for 30 days post-termination.",
    "b.md": "Customer Data export is available for 90 days post-termination.",
  });
  const r = auditTermAndExit({
    root: dir,
    walk: [],
    topics: [
      {
        topic: "export-window",
        question: "q",
        normalise: "days",
        sources: [
          { file: "a.md", re: /available for (\d+\s*days?) post-termination/i },
          { file: "b.md", re: /available for (\d+\s*days?) post-termination/i },
        ],
      },
    ],
    registerFile: "docs/NOPE.md",
  });
  assert.equal(r.topics[0].resolvedHere, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 — a window stated the same way in two documents agrees; units are normalised, not compared as text", () => {
  const dir = repo({
    "a.md": "Hard delete of Customer Data within 60 days.",
    "b.md": "Hard delete of Customer Data within 2 months.",
  });
  const r = auditTermAndExit({
    root: dir,
    walk: [],
    topics: [
      {
        topic: "delete-window",
        question: "q",
        normalise: "days",
        sources: [
          { file: "a.md", re: /within (\d+\s*days?)/i },
          { file: "b.md", re: /within (\d+\s*months?)/i },
        ],
      },
    ],
    registerFile: "docs/NOPE.md",
  });
  // 60 days and 2 months are the same fact. Comparing the raw strings would report a conflict that
  // does not exist and teach the reader to ignore this register.
  assert.equal(r.summary.conflicts, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 RED — a declaration for a stage that is now delivered is STALE and goes red", () => {
  const dir = repo({ "legal/x.md": "It auto-renews for successive periods." });
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/REG.md"),
    REG(["| X-99 | open | this was written when the clause was missing and the clause has since been added | Ahmad |"]),
  );
  const r = auditTermAndExit({
    root: dir,
    walk: [{ id: "X-99", stage: "s", files: ["legal/x.md"], mentions: /auto-?renew/i }],
    topics: [],
    registerFile: "docs/REG.md",
  });
  assert.deepEqual(r.summary.staleDeclarations, ["X-99"]);
  assert.equal(r.summary.ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 RED — a declaration with no named decider is REFUSED and goes red", () => {
  const dir = repo({ "legal/x.md": "Nothing about leaving." });
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/REG.md"),
    "| topic | state | reason | who decides |\n| --- | --- | --- | --- |\n" +
      "| X-99 | open | a genuinely long reason that explains the situation in more than six words | |\n",
  );
  const r = auditTermAndExit({
    root: dir,
    walk: [{ id: "X-99", stage: "s", files: ["legal/x.md"], mentions: /auto-?renew/i }],
    topics: [],
    registerFile: "docs/REG.md",
  });
  assert.equal(r.summary.refusedDeclarations.length, 1);
  assert.equal(r.summary.ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ2 — the register the module names exists in the tree", () => {
  assert.ok(fs.existsSync(path.join(root, TERM_REGISTER)));
});

test("AZ2 — every stage names files and what the stage promises, never just a title", () => {
  for (const s of EXIT_WALK) {
    assert.ok(Array.isArray(s.files) && s.files.length > 0, `${s.id} must name the documents that carry it`);
    assert.ok(s.mentions instanceof RegExp, `${s.id} must state what it promises, not only where it lives`);
  }
});

test("AZ2 — every term topic exposes its value in capture group 1 of a real regex", () => {
  for (const t of TERM_TOPICS) {
    for (const s of t.sources) {
      assert.ok(s.re instanceof RegExp, `${t.topic} source for ${s.file} needs a regex`);
      assert.match(s.re.source, /\(/, `${t.topic} must capture the value it compares`);
    }
  }
});

test("AZ2 — an unreadable tree reports unwalked rather than green", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "term-nogit-"));
  const r = auditTermAndExit({ root: dir, walk: EXIT_WALK, topics: [], registerFile: "docs/NOPE.md" });
  assert.equal(r.headReadable, false);
  assert.equal(r.summary.ok, false);
  assert.match(statementFor(r), /unwalked rather than assumed/);
  fs.rmSync(dir, { recursive: true, force: true });
});
