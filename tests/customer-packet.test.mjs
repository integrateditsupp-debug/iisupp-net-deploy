// AY1 — the packet a PAYING customer receives, assembled from the shared line only.
//
// Red-first throughout, and the reds that matter are the ones about SOURCE and about SILENCE: a
// packet assembled from the working copy reports success on a document no clone can produce, and a
// packet that counts filenames reports success on a document that never mentions what it was
// promised for. Both are proven here by planting exactly that state.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  assembleCustomerPacket, customerManifest, customerPacketFilesFor, headTree,
  discardCustomerPacket, statementFor, CUSTOMER_PACKET, CUSTOMER_PACKET_SCHEMA,
} from "../scripts/lib/customer-packet.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A real, tiny git repository — the only honest way to test a module whose source is HEAD. */
function repo({ committed = {}, workingOnly = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "customer-repo-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  const write = (rel, text) => {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  };
  for (const [rel, text] of Object.entries(committed)) write(rel, text);
  if (Object.keys(committed).length) {
    git("add", "-A");
    git("commit", "-q", "-m", "committed");
  }
  for (const [rel, text] of Object.entries(workingOnly)) write(rel, text);
  return dir;
}

const ONE = [{
  section: "onboarding",
  who: "the customer's administrator",
  when: "week one",
  why: "the first thing a paying customer does is try to get in",
  files: ["onboard.html"],
}];

test("AY1 — the customer packet resolves against HEAD's tree and nothing is sent", () => {
  const r = assembleCustomerPacket({ root, dryRun: true });
  assert.equal(r.schema, CUSTOMER_PACKET_SCHEMA);
  assert.equal(r.source, "HEAD's tree — never the working copy, never the index");
  assert.equal(r.sent, false);
  assert.equal(r.attached, false);
  assert.equal(r.mailPathTouched, false);
  assert.equal(r.assembledIn, null, "a dry run writes nothing at all");
  assert.ok(r.summary.promised > 0);
});

test("AY1 — the real customer packet is complete: every promised document is in the shared line", () => {
  const r = assembleCustomerPacket({ root, dryRun: true });
  const bad = r.items.filter((i) => i.state !== "arrived").map((i) => `${i.file} (${i.state}: ${i.reason})`);
  assert.deepEqual(bad, [], `a paying customer is promised these and a clone cannot produce them:\n${bad.join("\n")}`);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AY1 — every section is non-empty: promising a customer nothing is not delivering everything", () => {
  const r = assembleCustomerPacket({ root, dryRun: true });
  const empty = Object.entries(r.sections).filter(([, v]) => v.empty).map(([k]) => k);
  assert.deepEqual(empty, [], "an empty section is a failure, never a clean one");
  assert.equal(r.summary.sectionsEmpty, 0);
});

test("AY1 — every section states who asks for it and WHEN, so nothing enters the packet unexplained", () => {
  for (const part of CUSTOMER_PACKET) {
    assert.ok(part.who && part.who.split(/\s+/).length >= 3, `${part.section} must say who asks for it`);
    assert.ok(part.when && part.when.length > 3, `${part.section} must say when it is asked for`);
    assert.ok(part.why && part.why.split(/\s+/).length >= 8, `${part.section} must state why a customer receives it`);
  }
});

test("AY1 RED — a document present on this machine and absent from HEAD is UNTRACKED, never delivered", () => {
  const dir = repo({ committed: { "keep.md": "x" }, workingOnly: { "onboard.html": "<h1>welcome</h1>" } });
  try {
    const r = assembleCustomerPacket({ root: dir, packet: ONE, dryRun: true });
    assert.equal(r.items[0].state, "untracked");
    assert.match(r.items[0].reason, /clone of this repository cannot produce it/);
    assert.equal(r.summary.arrived, 0, "a working-copy document must never count as delivered");
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 RED — an empty file in the shared line is not a document", () => {
  const dir = repo({ committed: { "onboard.html": "" } });
  try {
    const r = assembleCustomerPacket({ root: dir, packet: ONE, dryRun: true });
    assert.equal(r.items[0].state, "empty");
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 RED — a document that never mentions what its section promises is SILENT, not delivered", () => {
  const packet = [{ ...ONE[0], mentions: /export|data portability/i }];
  const dir = repo({ committed: { "onboard.html": "<h1>welcome</h1><p>nothing about getting anything back</p>" } });
  try {
    const r = assembleCustomerPacket({ root: dir, packet, dryRun: true });
    assert.equal(r.items[0].state, "silent", "a section marked delivered because a file exists is the failure");
    assert.match(r.items[0].reason, /never mentions what this section promises/);
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 GREEN — the same document passes once it speaks to the section it was promised for", () => {
  const packet = [{ ...ONE[0], mentions: /export|data portability/i }];
  const dir = repo({ committed: { "onboard.html": "<h1>welcome</h1><p>your data export lives here</p>" } });
  try {
    const r = assembleCustomerPacket({ root: dir, packet, dryRun: true });
    assert.equal(r.items[0].state, "arrived");
    assert.equal(r.summary.ok, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 RED — a section that resolves zero documents fails, and says so as its own class", () => {
  const packet = [{ section: "offboarding", who: "the leaving customer", when: "the exit", why: "how a company behaves on the way out is the reference the next buyer hears", dirs: ["nothing-here"] }];
  const dir = repo({ committed: { "keep.md": "x" } });
  try {
    const r = assembleCustomerPacket({ root: dir, packet, dryRun: true });
    assert.equal(r.sections.offboarding.empty, true);
    assert.equal(r.sections.offboarding.ok, false);
    assert.equal(r.summary.ok, false);
    assert.match(statementFor(r), /promises nothing, which is not the same as delivering everything/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 — directories expand from HEAD, so a working-copy-only file cannot pad a section", () => {
  const packet = [{ section: "admin", who: "the administrator", when: "week one", why: "the guide is the first document that has to work rather than persuade", dirs: ["guides"] }];
  const dir = repo({ committed: { "guides/real.md": "real" }, workingOnly: { "guides/ghost.md": "ghost" } });
  try {
    const { items } = customerManifest({ root: dir, packet });
    assert.deepEqual(items.map((i) => i.file), ["guides/real.md"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 — a nested file does not leak into a parent directory section", () => {
  const packet = [{ section: "admin", who: "the administrator", when: "week one", why: "letting a parent swallow a child section reports documents twice and hides an empty one", dirs: ["guides"] }];
  const dir = repo({ committed: { "guides/top.md": "a", "guides/deeper/nested.md": "b" } });
  try {
    const { items } = customerManifest({ root: dir, packet });
    assert.deepEqual(items.map((i) => i.file), ["guides/top.md"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 — a real assembly writes only into a throwaway directory, and it does not outlive the question", () => {
  const dir = repo({ committed: { "onboard.html": "<h1>welcome</h1>" } });
  try {
    const r = assembleCustomerPacket({ root: dir, packet: ONE, dryRun: false });
    assert.ok(r.assembledIn && r.assembledIn.startsWith(os.tmpdir()), "assembled outside the repository");
    assert.ok(fs.existsSync(path.join(r.assembledIn, "onboard.html")));
    assert.equal(fs.existsSync(path.join(dir, "customer-packet")), false, "nothing is written in-repo");
    assert.equal(discardCustomerPacket(r), true);
    assert.equal(fs.existsSync(r.assembledIn), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 RED — an unreadable HEAD is reported as unknown, never assumed to be fine", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-repo-"));
  try {
    const head = headTree({ root: dir });
    assert.equal(head.readable, false);
    const r = assembleCustomerPacket({ root: dir, packet: ONE, dryRun: true });
    assert.equal(r.summary.ok, false);
    assert.match(statementFor(r), /unknown — never assumed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY1 — the packet's files are exported for the AW1 leak gate, so gate and packet cannot drift", () => {
  const files = customerPacketFilesFor({ root });
  assert.ok(files.length >= 5, "the customer packet names real documents");
  assert.deepEqual(files, [...new Set(files)], "no duplicates: one document, one check");
  assert.deepEqual(files, [...files].sort(), "stable order, so a diff of this list is readable");
  const { items } = customerManifest({ root });
  for (const f of files) assert.ok(items.some((i) => i.file === f));
});
