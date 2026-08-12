// AX2 — every citation an answer makes, resolved against HEAD's tree.
//
// Red-first. The reds that matter are about SOURCE and about being CONFIDENTLY WRONG: a check that
// reads the working copy passes a citation no clone can follow; a check that normalises the URL it
// is checking is checking something else; a check that escapes a sentence's full stop reports a
// correct citation as a defect. All three were real bugs in this module before it shipped and all
// three are planted here.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  auditCitations, headTree, packDocuments, readRedirects, readGapDeclarations, statementFor,
  STATE, PACK_GLOBS, CITATION_GAPS,
} from "../scripts/lib/answer-citations.mjs";
import { assemblePacket } from "../scripts/lib/prospect-packet.mjs";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A real, tiny git repository — the only honest way to test a module whose source is HEAD. */
function repo({ committed = {}, workingOnly = {} } = {}) {
  const dir = makeScratchDir("citations-repo-");
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  const write = (rel, text) => {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  };
  for (const [rel, text] of Object.entries(committed)) write(rel, text);
  git("add", "-A");
  git("commit", "-q", "-m", "committed", "--allow-empty");
  for (const [rel, text] of Object.entries(workingOnly)) write(rel, text);
  return dir;
}

const GAPS = "gaps.md";
const GHEAD = "| Artefact | State | Reason | Who |\n|---|---|---|---|\n";
const GREASON = "the artefact has never been written and whether to write it or stop promising it is a decision";

test("AX2 — a citation to something in HEAD's tree RESOLVES", () => {
  const dir = repo({ committed: { "compliance/a.md": "See `legal/DPA-template.md`.", "legal/DPA-template.md": "x" } });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.resolved, 1);
  assert.equal(r.summary.ok, true);
});

test("AX2 — RED: a citation satisfied only by the WORKING COPY does not resolve", () => {
  // This is the whole discipline. A file on the operator's disk and absent from the shared line is
  // the failure being looked for; reading the working copy would hide it.
  const dir = repo({
    committed: { "compliance/a.md": "See `legal/DPA-template.md`." },
    workingOnly: { "legal/DPA-template.md": "x" },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.resolved, 0);
  assert.equal(r.summary.ok, false);
  assert.equal(fs.existsSync(path.join(dir, "legal/DPA-template.md")), true, "it is right there on disk, and that is the point");
});

test("AX2 — RED: an artefact under a DIFFERENT path is MISDIRECTED, not broken, and names the real path", () => {
  const dir = repo({
    committed: { "compliance/a.md": "See `network-capture.mjs`.", "deep/src/network-capture.mjs": "x" },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.misdirected, 1);
  assert.equal(r.summary.broken, 0, "misdirected and broken are different repairs and must not be collapsed");
  assert.deepEqual(r.misdirected[0].nearest, ["deep/src/network-capture.mjs"]);
  assert.equal(r.summary.ok, false, "a reviewer following it still finds nothing");
});

test("AX2 — RED: nothing in the tree carries it at all — BROKEN, and red while nobody has said so", () => {
  const dir = repo({ committed: { "compliance/a.md": "See `governance/risk-register.md`." } });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.broken, 1);
  assert.equal(r.summary.brokenUndeclared, 1);
  assert.equal(r.summary.ok, false);
});

test("AX2 — a declared gap is staged rather than hidden, and does not hold the registry red", () => {
  const dir = repo({
    committed: {
      "compliance/a.md": "See `governance/risk-register.md`.",
      [GAPS]: `${GHEAD}| \`governance/risk-register.md\` | open | ${GREASON} | Ahmad |\n`,
    },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.brokenUndeclared, 0);
  assert.equal(r.summary.brokenDeclared, 1, "declared is not the same as gone");
  assert.equal(r.summary.ok, true);
});

test("AX2 — RED: a rubber-stamp gap declaration is REFUSED", () => {
  const dir = repo({
    committed: {
      "compliance/a.md": "See `governance/risk-register.md`.",
      [GAPS]: `${GHEAD}| \`governance/risk-register.md\` | open | tbd | Ahmad |\n`,
    },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.refusedGapDeclarations, 1);
  assert.equal(r.summary.ok, false);
});

test("AX2 — RED: a gap declaration matching nothing is STALE", () => {
  const dir = repo({
    committed: {
      "compliance/a.md": "no citations here",
      [GAPS]: `${GHEAD}| \`governance/risk-register.md\` | open | ${GREASON} | Ahmad |\n`,
    },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.staleGapDeclarations, 1);
  assert.equal(r.summary.ok, false);
});

test("AX2 — a `documents/`-scoped citation is EXCLUDED with its reason: neither resolved nor broken", () => {
  const dir = repo({ committed: { "compliance/a.md": "See `documents/internal-thing.md`." } });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.excluded, 1);
  assert.equal(r.summary.broken, 0, "never rounded down: the document exists and the operator can hand it over");
  assert.equal(r.summary.resolved, 0, "never rounded up: a clone cannot produce it");
  assert.match(r.excluded[0].reason, /lockdown/i);
  assert.equal(r.summary.ok, true, "rounding the lockdown into a defect would push us to weaken the lockdown");
});

test("AX2 — RED: a section that does not exist in the cited document is SECTION-BROKEN", () => {
  const dir = repo({
    committed: { "compliance/a.md": "Per `legal/BAA-template.md` Section 6.", "legal/BAA-template.md": "## 1. Scope\n## 2. Terms\n" },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.sectionBroken, 1);
  assert.equal(r.summary.ok, false, "a file-existence check passes this and a reviewer opening the document does not");
});

test("AX2 — a section that DOES exist resolves, and a sentence's full stop does not break it", () => {
  // The first version escaped the trailing "." into the pattern and reported two correct citations
  // as defects — a check confidently wrong about a punctuation mark.
  const dir = repo({
    committed: {
      "compliance/a.md": "Per `legal/BAA-template.md` Section 6.\nAnd `compliance/b.md` Section CC3.",
      "legal/BAA-template.md": "## 6. Breach notification\n",
      "compliance/b.md": "## CC3 — Risk Assessment\n| CC3.1 | x |\n",
    },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.sectionBroken, 0, statementFor(r));
  assert.equal(r.summary.resolved, 2);
});

test("AX2 — a rooted URL served by a redirect resolves, in the EXACT form it is cited", () => {
  const dir = repo({
    committed: {
      "compliance/a.md": "See `/privacy`.",
      "governance/privacy.html": "x",
      "netlify.toml": '[[redirects]]\n  from = "/privacy"\n  to = "/governance/privacy.html"\n  status = 200\n',
    },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(readRedirects({ root: dir }).map.get("/privacy"), "/governance/privacy.html");
  assert.equal(r.summary.resolved + r.summary.misdirected + r.summary.broken, 0, "an extensionless URL is not a path citation shape");
});

test("AX2 — RED: `/privacy.html` is NOT served by a redirect for `/privacy`", () => {
  // The real bug this test exists for: consulting the redirect table with the extension stripped
  // made a citation that 404s report as served. A link checker that normalises the thing it is
  // checking is checking something else.
  const dir = repo({
    committed: {
      "compliance/a.md": "See `/privacy.html`.",
      "governance/privacy.html": "x",
      "netlify.toml": '[[redirects]]\n  from = "/privacy"\n  to = "/governance/privacy.html"\n  status = 200\n',
    },
  });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.resolved, 0);
  assert.equal(r.summary.misdirected, 1, "the page exists at governance/privacy.html and this URL does not reach it");
  assert.deepEqual(r.misdirected[0].nearest, ["governance/privacy.html"]);
});

test("AX2 — one promise, one row: a section citation is not double-counted as a path citation", () => {
  const dir = repo({ committed: { "compliance/a.md": "Per `legal/BAA-template.md` Section 6.", "legal/BAA-template.md": "## 6. x\n" } });
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.summary.total, 1);
});

test("AX2 — RED: an unreadable HEAD is reported, never assumed clean", () => {
  const dir = makeScratchDir("not-a-repo-");
  const r = auditCitations({ root: dir, gapsFile: GAPS });
  assert.equal(r.headReadable, false);
  assert.equal(r.summary.ok, false);
  assert.match(statementFor(r), /could not be read/i);
});

test("AX2 — the pack this reads is the pack AW3 assembles — the two cannot drift", () => {
  const tree = headTree({ root });
  const docs = new Set(packDocuments(tree, PACK_GLOBS));
  const packet = assemblePacket({ root, dryRun: true });
  const promisedMd = packet.items.filter((i) => i.file.endsWith(".md") && i.state === "arrived").map((i) => i.file);
  const missed = promisedMd.filter((f) => !docs.has(f));
  assert.deepEqual(missed, [], "every markdown document a prospect receives has its citations resolved");
});

test("AX2 — the real pack: no citation promises something a reviewer cannot follow, and no gap is silent", () => {
  const r = auditCitations({ root });
  assert.equal(r.headReadable, true);
  assert.equal(r.redirectsRead, true, "the redirect table is read rather than guessed at");
  assert.equal(r.summary.misdirected, 0, statementFor(r));
  assert.equal(r.summary.sectionBroken, 0, statementFor(r));
  assert.equal(r.summary.brokenUndeclared, 0, statementFor(r));
  assert.equal(r.summary.staleGapDeclarations, 0);
  assert.equal(r.summary.refusedGapDeclarations, 0);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AX2 — the real gaps register exists and every entry names a reason and a decider", () => {
  const g = readGapDeclarations({ root });
  assert.equal(g.present, true, `${CITATION_GAPS} is part of the shared line`);
  assert.equal(g.refused.length, 0);
  for (const d of g.declarations.values()) {
    assert.ok(d.whoDecides, "every gap names a decider");
    assert.ok(d.reason.split(/\s+/).length >= 12, "a real reason, not a shrug");
  }
});
