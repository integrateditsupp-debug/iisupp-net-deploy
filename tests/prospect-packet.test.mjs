// AW3 — the packet a prospect actually receives, assembled from the shared line only.
//
// Red-first throughout, and the reds that matter here are the ones about SOURCE: a packet assembled
// from the working copy would report success on a document no clone can produce, which is the exact
// failure AU1 found on a single agreement and this task asks of the whole packet.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  assemblePacket, packetManifest, headTree, discardPacket, statementFor, PACKET,
} from "../scripts/lib/prospect-packet.mjs";
import { auditClientFacing } from "../scripts/lib/client-facing-leak.mjs";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A real, tiny git repository — the only honest way to test a module whose source is HEAD. */
function repo({ committed = {}, workingOnly = {} }) {
  const dir = makeScratchDir("packet-repo-");
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

const ONE = [{ section: "agreement", who: "the signer", why: "the document that starts the engagement", dirs: ["legal"] }];

test("AW3 RED FIRST — a document that exists only on this machine is UNTRACKED, never delivered", () => {
  const dir = repo({
    committed: { "legal/A.md": "committed agreement\n" },
    workingOnly: { "legal/B.md": "this file has never been committed\n" },
  });
  const packet = [{ ...ONE[0], files: ["legal/A.md", "legal/B.md"], dirs: [] }];
  const r = assemblePacket({ root: dir, packet, dryRun: true });

  const b = r.items.find((i) => i.file === "legal/B.md");
  assert.equal(b.state, "untracked", "a file on disk and not in HEAD cannot travel, and saying so is the point");
  assert.match(b.reason, /clone/);
  assert.equal(r.summary.untracked, 1);
  assert.equal(r.summary.arrived, 1);
  assert.equal(r.summary.ok, false, "a packet with a document that cannot be produced is not a packet");
  assert.match(statementFor(r), /legal\/B\.md \(untracked\)/);
});

test("AW3 — directories expand from HEAD, so a working-copy file can never pad the packet", () => {
  const dir = repo({
    committed: { "legal/A.md": "one\n" },
    workingOnly: { "legal/Z.md": "never committed\n" },
  });
  const { items } = packetManifest({ root: dir, packet: ONE });
  assert.deepEqual(items.map((i) => i.file), ["legal/A.md"],
    "expanding a directory from disk would count a document a client can never receive");
});

test("AW3 — the bytes are HEAD's bytes, not the working copy's", () => {
  const dir = repo({ committed: { "legal/A.md": "the committed text\n" } });
  fs.writeFileSync(path.join(dir, "legal/A.md"), "EDITED ON THIS MACHINE ONLY, MUCH LONGER TEXT\n");
  const r = assemblePacket({ root: dir, packet: ONE });
  try {
    const arrived = r.items[0];
    assert.equal(arrived.state, "arrived");
    assert.equal(arrived.bytes, Buffer.byteLength("the committed text\n"),
      "reading the working copy would report a document a prospect will never see");
    const onDisk = fs.readFileSync(path.join(r.assembledIn, "legal/A.md"), "utf8");
    assert.equal(onDisk, "the committed text\n");
  } finally {
    discardPacket(r);
  }
});

test("AW3 — an empty file in the shared line is not a document", () => {
  const dir = repo({ committed: { "legal/A.md": "" } });
  const r = assemblePacket({ root: dir, packet: ONE, dryRun: true });
  assert.equal(r.items[0].state, "empty");
  assert.equal(r.summary.ok, false, "a zero-byte policy arrives and answers nothing");
});

test("AW3 — an empty SECTION fails, because promising nothing is not the same as delivering everything", () => {
  const dir = repo({ committed: { "legal/A.md": "one\n" } });
  const packet = [...ONE, { section: "policies", who: "the reviewer", why: "asked for by name", dirs: ["compliance/policies"] }];
  const r = assemblePacket({ root: dir, packet, dryRun: true });
  assert.equal(r.sections.policies.promised, 0);
  assert.equal(r.sections.policies.ok, false, "zero of zero is the shape a hole hides in");
  assert.equal(r.summary.ok, false);
});

test("AW3 — an unreadable HEAD is reported as unknown and never guessed", () => {
  const dir = makeScratchDir("packet-nogit-");
  const r = assemblePacket({ root: dir, packet: ONE, dryRun: true });
  assert.equal(r.headReadable, false);
  assert.equal(r.summary.ok, false);
  assert.match(statementFor(r), /never assumed/);
});

test("AW3 — assembling answers a question about delivery and delivers nothing", () => {
  const dir = repo({ committed: { "legal/A.md": "one\n" } });
  const r = assemblePacket({ root: dir, packet: ONE });
  try {
    assert.equal(r.sent, false);
    assert.equal(r.attached, false);
    assert.equal(r.mailPathTouched, false);
    // The throwaway directory is outside the repository, always.
    assert.ok(!path.resolve(r.assembledIn).startsWith(path.resolve(dir)),
      "a packet assembled inside the repository is a packet that gets committed by accident");
    assert.ok(fs.existsSync(path.join(r.assembledIn, "legal/A.md")));
  } finally {
    assert.equal(discardPacket(r), true);
    assert.equal(fs.existsSync(r.assembledIn), false, "a directory of client documents does not outlive the question");
  }
  // And dryRun writes nothing at all while still resolving every document.
  const dry = assemblePacket({ root: dir, packet: ONE, dryRun: true });
  assert.equal(dry.assembledIn, null);
  assert.equal(dry.summary.arrived, 1);
});

test("AW3 — every section says who asks for it and why, or it is not in the packet", () => {
  assert.ok(PACKET.length >= 5);
  for (const part of PACKET) {
    assert.ok(part.section && part.who, `${part.section}: a section names the reader who asks for it`);
    assert.ok(part.why && part.why.length > 40,
      `${part.section}: a document cannot join what a client receives without a stated reason`);
    assert.ok((part.files || []).length || (part.dirs || []).length);
  }
});

test("AW3 — the real tree: a clone can produce every document this packet promises", () => {
  const r = assemblePacket({ root, dryRun: true });
  assert.equal(r.headReadable, true, "HEAD must be readable, or the answer is a guess");
  assert.ok(r.summary.promised >= 27, `the packet must promise the receivable set (got ${r.summary.promised})`);
  assert.equal(r.summary.untracked, 0,
    `promised and outside the shared line: ${r.untracked.map((u) => u.file).join(" · ")}`);
  assert.equal(r.summary.failed, 0,
    `cannot be produced from a clone: ${r.items.filter((i) => i.state !== "arrived").map((i) => `${i.file} (${i.state})`).join(" · ")}`);
  assert.equal(r.summary.sectionsOk, r.summary.sections);
  assert.equal(r.summary.ok, true);
  assert.equal(r.sent, false);
});

test("AW3 — the packet and the leak gate see the same documents, or one of them is lying", () => {
  // The invariant that keeps AW1 and AW3 from drifting: a document the gate audits as receivable
  // must be a document the packet promises. Divergence means either a client receives something
  // nothing reads, or the packet promises something nobody checks.
  const audited = new Set(auditClientFacing({ root }).documents.map((d) => d.file));
  const promised = new Set(assemblePacket({ root, dryRun: true }).items.map((i) => i.file));
  const auditedNotPromised = [...audited].filter((f) => !promised.has(f));
  assert.deepEqual(auditedNotPromised, [],
    `audited as client-facing but never promised to anyone: ${auditedNotPromised.join(" · ")}`);
  const promisedNotAudited = [...promised].filter((f) => !audited.has(f));
  assert.deepEqual(promisedNotAudited, [],
    `promised to a prospect and never read by the leak gate: ${promisedNotAudited.join(" · ")}`);
});
