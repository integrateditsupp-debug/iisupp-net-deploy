// yes-path.test.mjs — RUN-AT / AT1.
//
// The claim under test: the route from an inbound reply to a first dollar is resolved against
// artefacts on disk, and a step with nothing behind it is named MISSING with what it blocks —
// never softened into "handled manually".
//
// RED-FIRST, each against a real failure rather than a mock:
//   · a step whose artefact does not exist            → missing, and it names the steps below it
//   · a step whose artefact exists but is not tracked  → untracked, NOT rounded up to present
//   · a form a visitor fills that sends nowhere        → unusable
//   · an artefact printing a domain the tree does not  → unusable, with the found/expected pair
//   · a manual-by-design step with no artefact         → still missing; the reason is not a pass
//   · a directory that is not a git repository         → trackedReadable false, never a silent pass
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  resolveYesPath, statementFor, canonicalContact, contactFindings, handInputs,
  CLASSES, STEPS, YES_PATH_SCHEMA,
} from "../scripts/lib/yes-path.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (args, cwd) =>
  execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();

/** A miniature of the real situation, built with real git so "tracked" means what git means. */
function world({ files = {}, ignore = "", track = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "at1-yespath-"));
  git(["init", "--quiet", "--initial-branch=main"], dir);
  git(["config", "user.email", "t@t.t"], dir);
  git(["config", "user.name", "t"], dir);
  fs.writeFileSync(path.join(dir, "index.html"), "<a href='tel:+16475813182'>iisupp.net</a>");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  if (ignore) fs.writeFileSync(path.join(dir, ".gitignore"), ignore);
  if (track) {
    git(["add", "-A"], dir);
    git(["commit", "--quiet", "-m", "base"], dir);
  }
  return dir;
}

const step = (id, artefacts, manual = null) => ({ id, name: id, manual, artefacts });
const doc = (p, must = ["nonEmpty"]) => ({ path: p, kind: "doc", must });

test("AT1 · a step with no artefact is MISSING and names the steps it blocks", () => {
  const dir = world({ files: { "a.md": "ok\n" } });
  const r = resolveYesPath({
    root: dir,
    steps: [step("one", [doc("a.md")]), step("two", [doc("gone.md")]), step("three", [doc("a.md")])],
  });
  assert.equal(r.schema, YES_PATH_SCHEMA);
  assert.equal(r.steps[1].class, CLASSES.MISSING);
  assert.deepEqual(r.steps[1].blocks, ["three"]);
  assert.equal(r.summary.firstGap, "two");
  assert.equal(r.summary.complete, false);
  assert.match(statementFor(r), /breaks at/);
});

test("AT1 · an artefact git does not carry is UNTRACKED, never rounded up to present", () => {
  const dir = world({ files: { "carried.md": "x\n" }, ignore: "local/\n" });
  fs.mkdirSync(path.join(dir, "local"));
  fs.writeFileSync(path.join(dir, "local/agreement.md"), "sign here\n");
  const r = resolveYesPath({ root: dir, steps: [step("sign", [doc("local/agreement.md")])] });
  assert.equal(r.steps[0].class, CLASSES.UNTRACKED);
  assert.equal(r.steps[0].artefacts[0].tracked, false);
  assert.match(r.steps[0].artefacts[0].detail, /clone of this repository cannot produce it/);
  assert.equal(r.summary.untracked, 1);
  assert.equal(r.summary.present, 0);
});

test("AT1 · a form that sends nowhere is UNUSABLE, and one that submits by fetch is not", () => {
  const dead = world({ files: { "book.html": '<input id="b-name"><button>Go</button>' } });
  const live = world({ files: { "book.html": '<input id="b-name"><script>fetch("/x")</script>' } });
  const specs = [step("book", [{ path: "book.html", kind: "form", must: ["nonEmpty", "submits"] }])];
  assert.equal(resolveYesPath({ root: dead, steps: specs }).steps[0].class, CLASSES.UNUSABLE);
  assert.equal(resolveYesPath({ root: live, steps: specs }).steps[0].class, CLASSES.PRESENT);
});

test("AT1 · an artefact printing a domain the tree does not publish is UNUSABLE and names both", () => {
  const dir = world({ files: { "a.md": "call us at iisupport.net\n" } });
  const r = resolveYesPath({ root: dir, steps: [step("scope", [doc("a.md", ["nonEmpty", "contact"])])] });
  assert.equal(r.steps[0].class, CLASSES.UNUSABLE);
  const f = r.steps[0].artefacts[0].findings.find((x) => x.kind === "contact-domain");
  assert.equal(f.found, "iisupport.net");
  assert.equal(f.expected, "iisupp.net");
});

test("AT1 · manual-by-design does not excuse a missing artefact", () => {
  const dir = world({ files: { "a.md": "x\n" } });
  const r = resolveYesPath({
    root: dir,
    steps: [step("sign", [doc("nope.md")], { because: "a person signs" })],
  });
  assert.equal(r.steps[0].manualByDesign, true);
  assert.equal(r.steps[0].class, CLASSES.MISSING, "a reason is not a resolution");
  assert.equal(r.summary.manualByDesign, 1);
  assert.equal(r.summary.missing, 1);
});

test("AT1 · a step takes its BEST artefact and no better", () => {
  const dir = world({ files: { "good.md": "x\n" }, ignore: "local/\n" });
  fs.mkdirSync(path.join(dir, "local"));
  fs.writeFileSync(path.join(dir, "local/other.md"), "y\n");
  const r = resolveYesPath({
    root: dir,
    steps: [step("s", [doc("missing.md"), doc("local/other.md"), doc("good.md")])],
  });
  assert.equal(r.steps[0].class, CLASSES.PRESENT);
  assert.equal(r.steps[0].artefacts.map((a) => a.class).join(","), "missing,untracked,present");
});

test("AT1 · outside a repository the tracked read is declared unreadable, not assumed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "at1-norepo-"));
  fs.writeFileSync(path.join(dir, "a.md"), "x\n");
  const r = resolveYesPath({ root: dir, steps: [step("s", [doc("a.md")])] });
  assert.equal(r.trackedReadable, false);
  assert.equal(r.steps[0].artefacts[0].tracked, null);
});

test("AT1 · hand inputs are counted from the artefact, not estimated", () => {
  assert.equal(handInputs('<input id="b-name"><input id="b-email">', "form"), 2);
  assert.equal(handInputs("Client ________ effective ____________\n", "doc"), 2);
  assert.equal(handInputs("| Name | | |\n", "doc"), 1);
  assert.equal(handInputs("nothing to fill", "doc"), 0);
});

test("AT1 · the real tree: the path is walked, and every declared step resolves to a class", () => {
  const r = resolveYesPath({ root: REPO });
  assert.equal(r.steps.length, STEPS.length);
  assert.equal(r.contact.domain, "iisupp.net", "the canonical domain is read from the tree");
  for (const s of r.steps) {
    assert.ok(Object.values(CLASSES).includes(s.class), `${s.id} has a class`);
    assert.ok(s.artefacts.length > 0, `${s.id} names at least one artefact`);
  }
  // Reproducible from a clean clone: `documents/` is excluded by the security lockdown, so an
  // artefact under it is untracked HERE and missing THERE — both are non-present, and neither may
  // ever read as carried. Asserting that boundary rather than a machine-specific count.
  for (const s of r.steps) {
    for (const a of s.artefacts) {
      if (a.path.startsWith("documents/")) {
        assert.notEqual(a.class, CLASSES.PRESENT, `${a.path} must never read as carried by the shared line`);
      }
    }
  }
  assert.equal(typeof statementFor(r), "string");
});

test("AT1 · contactFindings ignores the canonical domain itself", () => {
  assert.deepEqual(contactFindings("visit iisupp.net today", { domain: "iisupp.net" }), []);
  assert.equal(canonicalContact({ root: REPO }).phone, "647-581-3182");
});
