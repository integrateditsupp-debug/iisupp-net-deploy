// staged-action-guard.test.mjs — AJ1. A staged one-click action must name a readable artefact.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   against RUN-AI's PRE-FIX state  — the item as it was actually written for fourteen days,
//                                           "twelve drafted second messages, awaiting one click",
//                                           with nothing on disk behind it.
//   GREEN against RUN-AI's POST-FIX state — the same item naming the send sheet that now exists.
//
// It also audits every CURRENTLY staged item against the same rule, so the guard is not a museum
// piece that only fails on a historical fixture.
//
// Run: node tests/staged-action-guard.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { auditStagedAction, auditStagedActions, assertStagedActionsHonest, CLASSES, STAGED_ACTION_GUARD_SCHEMA } =
  await import(new URL("../scripts/lib/staged-action-guard.mjs", import.meta.url).href);
const { needsAhmadStaged, NEEDS_AHMAD_SCHEMA } =
  await import(new URL("../scripts/lib/needs-ahmad-staged.mjs", import.meta.url).href);

// ── The two historical states, verbatim in shape ──────────────────────────────────────────────────

// What the list actually said, every cycle, from 2026-07-22 to 2026-08-05. No artefact key existed,
// because no artefact existed.
const PRE_FIX = {
  item: "Send the twelve follow-ups",
  what: "Twelve second messages, drafted and ready — roughly twenty minutes of copy and paste.",
  why: "The only item on this list that can move a business number.",
};

// What it says now: the same claim, with the file that makes the claim true.
const POST_FIX = {
  ...PRE_FIX,
  artefact: "senior-director-state/outbound/SEND-SHEET-2026-08-05.md",
  // RUN-AN / AN2 added rank + unblocks to the contract. Carried here so this fixture stays a shape
  // the live list can actually hold; the AJ1 assertion it proves (artefact present) is unchanged.
  rank: 1,
  unblocks: "the only item on the list that can produce a reply",
  blockedWithout: "the offer stays untested indefinitely",
};

test("RED against RUN-AI's pre-fix state — a staged claim with no artefact is refused BY NAME", () => {
  const f = auditStagedAction(PRE_FIX, { root: ROOT });
  assert.equal(f.ok, false, "the fourteen-day claim must not pass");
  assert.equal(f.class, CLASSES.NO_DECLARATION);
  assert.match(f.detail, /name the readable artefact/i);

  // And the whole-list form throws, so an emitter cannot write a feed carrying it.
  assert.throws(() => assertStagedActionsHonest([PRE_FIX], { root: ROOT }), /REFUSED/);
});

test("GREEN against RUN-AI's post-fix state — the same item, now naming a real non-empty file", () => {
  const recordRoot = path.join(ROOT, "senior-director-state");
  const f = auditStagedAction(POST_FIX, { root: ROOT });
  assert.equal(f.ok, true, "the corrected item must pass");

  if (fs.existsSync(recordRoot)) {
    // On the operator's machine the artefact is really there and is really verified.
    assert.equal(f.class, CLASSES.OK);
    assert.ok(f.bytes > 0, "the send sheet holds something a person can read");
  } else {
    // In a bare clone the untracked record root is absent. Say so; never call it green.
    assert.equal(f.class, CLASSES.UNVERIFIABLE);
    assert.match(f.note, /cannot be verified here/i);
  }
});

// ── The rest of the rule ──────────────────────────────────────────────────────────────────────────

// RUN-BR: the fixture carries a rank and an unblocks line so this case isolates the ARTEFACT rule.
// Without them the two checkouts disagreed for an unrelated reason: on the operator machine the missing
// artefact fails first and is reported MISSING, while in a clean clone the untracked root is absent, the
// artefact rule returns the honest UNVERIFIABLE pass, and AN2 priority then failed the same item by a
// different name. A guard whose verdict depends on which disk it runs on is the drift it exists to catch.
test("naming a file that does not exist fails — the click would have nothing to operate on", () => {
  const f = auditStagedAction(
    {
      item: "x",
      what: "y",
      artefact: "senior-director-state/outbound/NOT-A-REAL-FILE.md",
      rank: 1,
      unblocks: "nothing - this is a fixture that exists to be refused",
      blockedWithout: "nothing - this is a fixture that exists to be refused",
    },
    { root: ROOT },
  );
  if (fs.existsSync(path.join(ROOT, "senior-director-state"))) {
    assert.equal(f.ok, false);
    assert.equal(f.class, CLASSES.MISSING);
  } else {
    assert.equal(f.class, CLASSES.UNVERIFIABLE);
  }
});

test("an EMPTY artefact is not a handover", () => {
  const tmp = makeScratchDir("staged-guard-");
  try {
    fs.writeFileSync(path.join(tmp, "empty.md"), "");
    const f = auditStagedAction({ item: "x", what: "y", artefact: "empty.md" }, { root: tmp });
    assert.equal(f.ok, false);
    assert.equal(f.class, CLASSES.EMPTY);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("declaring noArtefact while the prose claims a drafted thing is refused — RUN-AI's exact shape", () => {
  const f = auditStagedAction(
    { item: "x", what: "Twelve messages are drafted and sitting on your disk.", noArtefact: "nothing to prepare" },
    { root: ROOT },
  );
  assert.equal(f.ok, false);
  assert.equal(f.class, CLASSES.PROSE_CLAIMS);
});

test("declaring BOTH an artefact and noArtefact is refused — one of the two is untrue", () => {
  const f = auditStagedAction({ item: "x", what: "y", artefact: "package.json", noArtefact: "none" }, { root: ROOT });
  assert.equal(f.ok, false);
  assert.equal(f.class, CLASSES.AMBIGUOUS);
});

test("an action genuinely taken in someone else's interface passes when it says so plainly", () => {
  const f = auditStagedAction(
    {
      item: "Publish the site",
      what: "One deliberate action in the hosting dashboard.",
      noArtefact: "a button in the provider's own interface",
      rank: 4, unblocks: "starts the visit log recording", blockedWithout: "no prospect can reach the site",
    },
    { root: ROOT },
  );
  assert.equal(f.ok, true);
  assert.equal(f.class, CLASSES.OK);
  assert.equal(f.artefact, null);
});

// ── The live audit: EVERY currently staged item, not just the historical fixture ───────────────────

test("every currently staged one-click item satisfies the guard", () => {
  assert.equal(NEEDS_AHMAD_SCHEMA, "needs-ahmad-staged.v2"); // AN2 tightened the contract; AJ1's proof below is untouched
  assert.ok(needsAhmadStaged.length > 0, "the staged list is not empty");

  const res = auditStagedActions(needsAhmadStaged, { root: ROOT });
  assert.equal(res.schema, STAGED_ACTION_GUARD_SCHEMA);
  assert.deepEqual(
    res.failures.map((f) => `${f.name} [${f.class}]`),
    [],
    "a staged item is claiming a click with nothing behind it",
  );
  // Each item accounted for individually — a summary that only counts can hide a shape.
  assert.equal(res.summary.audited, needsAhmadStaged.length);
  assert.equal(res.summary.failed, 0);
  for (const item of needsAhmadStaged) {
    const declared = (typeof item.artefact === "string") !== (typeof item.noArtefact === "string");
    assert.ok(declared, `${item.item} must declare exactly one of artefact / noArtefact`);
  }
});
