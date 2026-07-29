// F5 (SENTINEL-BRAIN-AUDIT) — honest guided walkthrough for unbound top recipes. Pure, injected, R11 + real-or-empty.
import assert from "node:assert/strict";
import {
  getGuidedWalkthrough, hasGuidedWalkthrough, scrubField,
  GUIDED_WALKTHROUGH_IDS
} from "../src/shared/unbound-recipe-walkthrough.mjs";

let groups = 0;
const group = (name, fn) => { fn(); groups++; console.log("  ok -", name); };

// 1 — real-or-empty: unknown / empty ids never invent a card.
group("real-or-empty on unknown, empty, and junk ids", () => {
  assert.equal(getGuidedWalkthrough(undefined), null);
  assert.equal(getGuidedWalkthrough(""), null);
  assert.equal(getGuidedWalkthrough("no-such-recipe"), null);
  assert.equal(getGuidedWalkthrough("flush-dns"), null, "bound/other recipes get no manual fallback here");
  assert.equal(hasGuidedWalkthrough("no-such-recipe"), false);
  assert.ok(GUIDED_WALKTHROUGH_IDS.includes("reset-network-stack"));
  assert.ok(GUIDED_WALKTHROUGH_IDS.includes("clear-print-queue"));
});

// 2 — the two F5 unbound top recipes each yield an honest, structured, NON-executing walkthrough.
group("reset-network-stack + clear-print-queue return honest guided steps", () => {
  for (const id of ["reset-network-stack", "clear-print-queue"]) {
    const w = getGuidedWalkthrough(id);
    assert.ok(w, `${id} has a walkthrough`);
    assert.equal(w.recipeId, id);
    assert.equal(w.manual, true, "every walkthrough is explicitly manual — never an auto action");
    assert.ok(typeof w.title === "string" && w.title.length > 0);
    assert.ok(typeof w.whyManual === "string" && w.whyManual.length > 10, "states WHY it is manual (honest, no dead action)");
    assert.ok(Array.isArray(w.steps) && w.steps.length >= 3, "real ordered steps");
    // steps are pure instructions — no auto-exec fields, correctly numbered.
    w.steps.forEach((s, i) => {
      assert.equal(s.n, i + 1, "steps numbered in order");
      assert.ok(typeof s.instruction === "string" && s.instruction.length > 0);
      assert.ok(!("run" in s) && !("exec" in s) && !("autoRun" in s), "no auto-execution field");
    });
  }
});

// 3 — irreversible / reboot semantics are stated honestly (Rule 14: no hidden cost).
group("honesty flags: reboot + irreversibility are disclosed", () => {
  const net = getGuidedWalkthrough("reset-network-stack");
  assert.equal(net.requiresReboot, true, "network reset discloses the reboot");
  assert.equal(net.reversible, false);
  assert.ok(/reboot|restart/i.test(net.safetyNote + JSON.stringify(net.steps)), "reboot mentioned in guidance");

  const print = getGuidedWalkthrough("clear-print-queue");
  assert.equal(print.reversible, false, "clearing the queue is irreversible");
  assert.ok(/re-?print|permanently|removed|deleted/i.test(print.safetyNote), "lost-jobs cost disclosed");
});

// 4 — self-retiring: once a real executor binding exists, the manual fallback disappears.
group("self-retiring via injected isBound (no competing with the real S2 plan)", () => {
  const alwaysBound = () => true;
  assert.equal(getGuidedWalkthrough("reset-network-stack", { isBound: alwaysBound }), null,
    "bound recipe -> automated plan takes over, no manual card");
  const boundOnlyPrint = (id) => id === "clear-print-queue";
  assert.equal(getGuidedWalkthrough("clear-print-queue", { isBound: boundOnlyPrint }), null);
  assert.ok(getGuidedWalkthrough("reset-network-stack", { isBound: boundOnlyPrint }), "still guided while unbound");
});

// 5 — R11: a path-like recipe id never resolves; scrubField neutralizes paths.
group("R11 — path-like ids are refused (check #1)", () => {
  assert.equal(getGuidedWalkthrough("C:\\Users\\ahmad\\secret\\reset-network-stack"), null);
  assert.equal(getGuidedWalkthrough("/home/ahmad/clear-print-queue"), null);
  assert.equal(hasGuidedWalkthrough("C:\\Users\\x\\reset-network-stack"), false);
  assert.equal(scrubField("C:\\Users\\ahmad\\thing"), "[path]");
  assert.equal(scrubField("/mnt/secret/file"), "[path]");
});

// 6 — returned object is a frozen deep copy; callers cannot mutate the authored source.
group("returned walkthrough is an immutable deep copy", () => {
  const a = getGuidedWalkthrough("reset-network-stack");
  assert.throws(() => { a.title = "hacked"; }, "top-level frozen");
  assert.throws(() => { a.steps[0].instruction = "x"; }, "nested frozen");
  const b = getGuidedWalkthrough("reset-network-stack");
  assert.notEqual(a, b, "fresh copy each call");
  assert.deepEqual(a, b, "but identical content");
});

console.log(`unbound-recipe-walkthrough test passed (${groups} groups · real-or-empty · manual-not-dead · reboot/irreversible disclosed · self-retiring via isBound · R11 path-guard · immutable deep copy).`);
