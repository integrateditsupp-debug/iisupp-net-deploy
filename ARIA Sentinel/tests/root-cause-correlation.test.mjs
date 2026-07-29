// F4 — cross-subsystem root-cause correlation. Pure, injected fixtures, real-or-empty + R11.
import assert from "node:assert/strict";
import {
  correlateAnomalies, collectFailingSubsystems, toResolutionPlanSeed,
  CORRELATION_RULES, MIN_CLUSTER
} from "../src/shared/root-cause-correlation.mjs";

let groups = 0;
const group = (name, fn) => { fn(); groups++; console.log("  ok -", name); };

// 1 — real-or-empty: no input / empty / single subsystem never correlates.
group("real-or-empty on nothing and on singletons", () => {
  assert.deepEqual(correlateAnomalies(undefined), []);
  assert.deepEqual(correlateAnomalies([]), []);
  assert.deepEqual(correlateAnomalies({}), []);
  // one flapping subsystem is NOT a cluster — stays a normal per-symptom fix.
  assert.deepEqual(correlateAnomalies([{ subsystem: "audio", count: 50 }]), []);
  assert.equal(toResolutionPlanSeed([{ subsystem: "wifi", count: 12 }]), null);
});

// 2 — the F4 headline case: audio + bluetooth + wifi -> ONE power/driver root cause.
group("co-failing related subsystems collapse to one root cause", () => {
  const clusters = correlateAnomalies([
    { subsystem: "audio", count: 14 },
    { subsystem: "bluetooth", count: 9 },
    { subsystem: "wifi", count: 11 }
  ]);
  assert.equal(clusters.length, 1, "three related failures -> exactly one cluster");
  const c = clusters[0];
  assert.equal(c.rootCause, "power-management-suspending-devices");
  assert.equal(c.planTrigger.kind, "detector-cluster");
  assert.deepEqual(c.subsystems.sort(), ["audio", "bluetooth", "wifi"]);
  assert.equal(c.sharedFix, "run-native-troubleshooter");
  assert.ok(c.confidence > 0 && c.confidence < 1, "confidence bounded, never faked to 1");
});

// 3 — unrelated subsystems from DIFFERENT families do not merge into a false cluster.
group("subsystems from different families do not falsely merge", () => {
  // audio (power family) + disk (storage family), one each -> no family reaches MIN_CLUSTER.
  const clusters = correlateAnomalies([
    { subsystem: "audio", count: 30 },
    { subsystem: "disk", count: 30 }
  ]);
  assert.deepEqual(clusters, [], "one-per-family is not a correlated cluster");
});

// 4 — two independent real clusters both surface, broadest-first ordering.
group("multiple real clusters, broadest first", () => {
  const clusters = correlateAnomalies([
    { subsystem: "network", count: 5 }, { subsystem: "dns", count: 5 }, { subsystem: "dhcp", count: 5 },
    { subsystem: "disk", count: 40 }, { subsystem: "search", count: 40 }
  ]);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].subsystems.length >= clusters[1].subsystems.length, true, "broader cluster ranked first");
  assert.deepEqual(clusters.map(c => c.rootCause).sort(), ["network-stack-degraded", "storage-pressure"]);
});

// 5 — accepts a context object (eventLog.errorsBySubsystem), same result as the array form.
group("context.eventLog input shape", () => {
  const ctx = { eventLog: { errorsBySubsystem: { network: 8, dns: 8, adapter: 3 } } };
  const clusters = correlateAnomalies(ctx);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].rootCause, "network-stack-degraded");
});

// 6 — R11 is check #1: an off-limits label is dropped content-blind before correlation.
group("R11 path-guard drops off-limits labels", () => {
  const collected = collectFailingSubsystems([
    { subsystem: "audio", count: 10 },
    { subsystem: "C:/Users/Ahmad/Private pics and Vids", count: 999 },
    { subsystem: "bluetooth", count: 10 }
  ]);
  const keys = [...collected.keys()].join("|");
  assert.equal(/private\s+pics\s+and\s+vids/i.test(keys), false, "off-limits label never enters correlation");
  // and the surviving audio+bluetooth still correlate correctly.
  assert.equal(correlateAnomalies([
    { subsystem: "audio", count: 10 },
    { subsystem: "private pics and vids", count: 999 },
    { subsystem: "bluetooth", count: 10 }
  ]).length, 1);
});

// 7 — threshold gates weak noise out (below-threshold counts don't count as failures).
group("threshold gates weak signals", () => {
  const clusters = correlateAnomalies(
    [{ subsystem: "audio", count: 2 }, { subsystem: "bluetooth", count: 2 }],
    { threshold: 5 }
  );
  assert.deepEqual(clusters, [], "signals below threshold are not co-failures");
});

// 8 — honest binding: unbound sharedFix -> runnableNow:false + guidanceOnly seed, never a dead action.
group("unbound shared fix degrades to guidance, not a dead action", () => {
  const seedBound = toResolutionPlanSeed(
    [{ subsystem: "network", count: 5 }, { subsystem: "dns", count: 5 }],
    { isBound: (id) => id === "flush-dns" }
  );
  assert.equal(seedBound.candidateSteps[0].runnableNow, true);
  assert.equal(seedBound.guidanceOnly, false);

  const seedUnbound = toResolutionPlanSeed(
    [{ subsystem: "network", count: 5 }, { subsystem: "dns", count: 5 }],
    { isBound: () => false }
  );
  assert.equal(seedUnbound.candidateSteps[0].runnableNow, false);
  assert.equal(seedUnbound.guidanceOnly, true, "unbound -> guidance walkthrough, never a live one-click");
});

// 9 — seed shape is a single plan (one id/trigger) for the whole correlated cluster.
group("seed is ONE plan for the whole cluster", () => {
  const seed = toResolutionPlanSeed([
    { subsystem: "audio", count: 14 }, { subsystem: "bluetooth", count: 9 }, { subsystem: "wifi", count: 11 }
  ]);
  assert.equal(seed.id, "correlated-power-management-suspending-devices");
  assert.equal(seed.trigger.kind, "detector-cluster");
  assert.equal(seed.candidateSteps.length, 1, "one shared fix, not one-per-symptom");
  assert.ok(Object.isFrozen(seed));
});

// 10 — ruleset invariants: constant + rules well-formed.
group("ruleset invariants", () => {
  assert.equal(MIN_CLUSTER, 2);
  assert.ok(CORRELATION_RULES.length >= 3);
  for (const r of CORRELATION_RULES) {
    assert.ok(r.rootCause && r.label && r.explains);
    assert.ok(Array.isArray(r.subsystems) && r.subsystems.length >= MIN_CLUSTER);
    assert.ok(typeof r.sharedFix === "string" && r.sharedFix.length > 0);
  }
});

console.log(`root-cause-correlation test passed (${groups} groups · F4 co-failure -> ONE plan · real-or-empty on singletons/empty · families never falsely merge · R11 drops off-limits labels · unbound fix -> honest guidance).`);
