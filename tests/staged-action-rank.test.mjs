// staged-action-rank.test.mjs — RUN-AN / AN2. A staged one-click list is not a set of equals.
//
// AJ1 made a staged action name its artefact. That closed "the click has nothing behind it". It did
// not close the next thing: for three cycles the list was presented as four items of equal weight
// when exactly one of them could move a business number and exactly one would remove another item
// from the list permanently. Four things you could click, in the order somebody typed them, is not
// a handover — the reader has to re-derive the priority every cycle, and mostly does not.
//
// This suite proves the guard now refuses an unranked item BY NAME, and that the order the operator
// sees is asserted by a test rather than by the order of the array literal.
//
// Run: node tests/staged-action-rank.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { auditStagedAction, auditStagedActions, assertStagedActionsHonest, rankedStagedActions, CLASSES } =
  await import(new URL("../scripts/lib/staged-action-guard.mjs", import.meta.url).href);
const { needsAhmadStaged, NEEDS_AHMAD_SCHEMA } =
  await import(new URL("../scripts/lib/needs-ahmad-staged.mjs", import.meta.url).href);

// The list exactly as it read for three cycles: artefact-backed (AJ1 green) and completely flat.
const FLAT = {
  item: "Publish the site",
  what: "One deliberate operator action in the hosting dashboard.",
  why: "Landing a branch never deploys. This stays a separate human decision.",
  noArtefact: "A publish is a button in the hosting provider's own interface.",
};

test("RED — an item that declares neither a rank nor what it unblocks is refused BY NAME", () => {
  const f = auditStagedAction(FLAT, { root: ROOT });
  assert.equal(f.ok, false, "the flat three-cycle item must not pass");
  assert.equal(f.class, CLASSES.NO_PRIORITY);
  assert.match(f.detail, /not a set of equals/i);

  // And the throwing form refuses, so an emitter cannot publish a feed carrying a flat list.
  assert.throws(() => assertStagedActionsHonest([FLAT], { root: ROOT }), /REFUSED/);
});

test("RED — half a declaration is refused, and the two halves fail under different names", () => {
  const rankOnly = { ...FLAT, rank: 4 };
  const unblocksOnly = { ...FLAT, unblocks: "starts the visit log recording" };
  assert.equal(auditStagedAction(rankOnly, { root: ROOT }).class, CLASSES.NO_UNBLOCKS);
  assert.equal(auditStagedAction(unblocksOnly, { root: ROOT }).class, CLASSES.NO_RANK);
});

test("RED — a rank that is not a positive integer is refused", () => {
  for (const bad of [0, -1, 1.5, "1", null]) {
    const f = auditStagedAction({ ...FLAT, rank: bad, unblocks: "x" }, { root: ROOT });
    assert.equal(f.ok, false, `rank ${JSON.stringify(bad)} must not pass`);
    assert.ok([CLASSES.BAD_RANK, CLASSES.NO_PRIORITY, CLASSES.NO_RANK].includes(f.class), `${bad} -> ${f.class}`);
  }
});

test("RED — two items claiming the same rank fail at the LIST level (an order with ties is not an order)", () => {
  const a = { ...FLAT, item: "A", rank: 1, unblocks: "a" };
  const b = { ...FLAT, item: "B", rank: 1, unblocks: "b" };
  const res = auditStagedActions([a, b], { root: ROOT });
  assert.equal(res.ok, false);
  assert.equal(res.failures.length, 2, "both halves of the tie are named, not just the second one");
  assert.equal(res.failures[0].class, CLASSES.DUPLICATE_RANK);
  assert.match(res.failures[0].detail, /an order with ties is not an order/);
});

test("GREEN — the same item, ranked and with its consequence stated, passes", () => {
  const fixed = {
    ...FLAT,
    rank: 4,
    unblocks: "Starts the visit log recording, the only passive signal that needs nobody to answer.",
    blockedWithout: "No prospect can reach the site at all.",
  };
  assert.equal(auditStagedAction(fixed, { root: ROOT }).ok, true);
});

// ── The live list ──────────────────────────────────────────────────────────────────────────────────

test("THE REAL LIST — every staged item declares a rank, what it unblocks, and what stays blocked", () => {
  assert.equal(NEEDS_AHMAD_SCHEMA, "needs-ahmad-staged.v2", "the schema must move when the contract does");
  const res = auditStagedActions(needsAhmadStaged, { root: ROOT });
  assert.equal(res.ok, true, JSON.stringify(res.failures, null, 2));

  for (const i of needsAhmadStaged) {
    assert.ok(Number.isInteger(i.rank) && i.rank >= 1, `${i.item} has no usable rank`);
    assert.ok(i.unblocks && i.unblocks.trim().length > 20, `${i.item} does not say what it unblocks`);
    assert.ok(
      i.blockedWithout && i.blockedWithout.trim().length > 20,
      `${i.item} states a priority without the cost of skipping it — that is a preference, not a priority`,
    );
  }
});

test("THE REAL LIST — ranks are a permutation of 1..n, so no gaps and no ties", () => {
  const ranks = needsAhmadStaged.map((i) => i.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, needsAhmadStaged.map((_, i) => i + 1));
});

test("THE ORDER IS ASSERTED, not typed — the send leads and the credential outranks the push", () => {
  const order = rankedStagedActions(needsAhmadStaged).map((i) => i.item);

  assert.match(order[0], /send the twelve/i,
    "the only item that can move a business number must be first, whatever order the array is written in");

  const credential = order.findIndex((i) => /credential/i.test(i));
  const push = order.findIndex((i) => /push the shared line/i.test(i));
  assert.ok(credential > -1 && push > -1);
  assert.ok(credential < push,
    "the item that RETIRES the push permanently must outrank the push it retires; otherwise the list " +
      "re-stages the same click forever, which is what happened for nineteen cycles");

  // And the assertion has teeth: the ranked order must not merely echo the array literal by luck.
  const typed = needsAhmadStaged.map((i) => i.item);
  assert.notDeepEqual(order, typed, "rank order and typed order coincide — this test would not catch a re-typing");
});

test("rankedStagedActions is pure — it never mutates the live list", () => {
  const before = needsAhmadStaged.map((i) => i.item);
  rankedStagedActions(needsAhmadStaged);
  assert.deepEqual(needsAhmadStaged.map((i) => i.item), before);
});

test("AJ1 still holds — ranking did not weaken the artefact rule", () => {
  const proseClaimsButNoArtefact = {
    item: "Send the twelve follow-ups",
    what: "Twelve second messages, drafted and ready.",
    why: "The only item that can move a business number.",
    noArtefact: "nothing to prepare",
    rank: 1,
    unblocks: "a reply",
    blockedWithout: "no reply",
  };
  const f = auditStagedAction(proseClaimsButNoArtefact, { root: ROOT });
  assert.equal(f.ok, false);
  assert.equal(f.class, CLASSES.PROSE_CLAIMS);
});
