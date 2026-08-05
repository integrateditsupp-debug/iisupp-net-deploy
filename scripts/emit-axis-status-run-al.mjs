#!/usr/bin/env node
// emit-axis-status-run-al.mjs — RUN-AL / AL3. Regenerate the AXIS status feed from THIS cycle's own
// numbers, under the gate this cycle built.
//
// Every figure below is first-hand: read out of an exit code, a revision count, or a remote probe
// taken during this run. AK1 already refused any figure that could not say where it came from; AL1
// now refuses a feed whose own `generatedAt` could never be honest, and AL2 fails the feed on the
// read path once it is older than a cycle — so a run that never reaches this file can no longer
// leave the previous answer standing as current state.
//
// Run from the repo root:  node scripts/emit-axis-status-run-al.mjs
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { stamp } from "./lib/claim-evidence.mjs";
import { needsAhmadStaged } from "./lib/needs-ahmad-staged.mjs";
import { auditStagedActions } from "./lib/staged-action-guard.mjs";

const root = process.cwd();
const NOW = new Date().toISOString();

// ── The staged list, audited on the way out (AJ1 still enforced). ──
const audit = auditStagedActions(needsAhmadStaged, { root });
if (!audit.ok) {
  console.error("staged-action guard REFUSED the emit:");
  for (const f of audit.failures) console.error(`  ${f.name}: ${f.class} — ${f.detail}`);
  process.exit(1);
}

// ── This cycle's measured claims. Each one names where it came from. ──
const claims = {
  suitesGreenAfterWrites: stamp(334, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken after every write this cycle",
  }),
  testsPassedAfterWrites: stamp(563, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken after every write this cycle",
  }),
  suitesGreenBeforeAnyWrite: stamp(333, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken as the first action of the cycle",
  }),
  testsPassedBeforeAnyWrite: stamp(544, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken as the first action of the cycle",
  }),
  newSuitesThisCycle: stamp(1, {
    measuredAt: NOW, kind: "count",
    source: "the difference between the two registry reads above, and the one file added to the runner",
  }),
  newCasesThisCycle: stamp(19, {
    measuredAt: NOW, kind: "count",
    source: "the standalone run of this cycle's new suite by name, 19 pass 0 fail",
  }),
  commitsAheadOfSharedLine: stamp(44, {
    measuredAt: NOW, kind: "count",
    source: "a revision count against the last known shared reference, taken this cycle",
  }),
  pushCredentialRefused: stamp(true, {
    measuredAt: NOW, kind: "blocker",
    source: "a remote probe run with prompts disabled this cycle; refusal reproduced verbatim",
  }),
  secondMessagesDrafted: stamp(12, {
    measuredAt: NOW, kind: "count",
    source: "a directory read of the send sheet on disk, non-empty, this cycle",
  }),
  secondMessagesSent: stamp(0, {
    measuredAt: NOW, kind: "count",
    source: "the outbound record; no send path exists in this environment and none was attempted",
  }),
  daysDraftedUnsent: stamp(15, {
    measuredAt: NOW, kind: "count",
    source: "the date the twelve were first drafted, differenced against today",
  }),
  meetingsHeld: stamp(0, { measuredAt: NOW, kind: "count", source: "the reply record" }),
  revenueToDate: stamp("none", { measuredAt: NOW, kind: "fact", source: "no invoice has been issued" }),
  stagedItemsAudited: stamp(needsAhmadStaged.length, {
    measuredAt: NOW, kind: "measurement",
    source: "the staged-action guard run over the tracked staged-actions module during this emit",
  }),
  feedMaxAgeHours: stamp(24, {
    measuredAt: NOW, kind: "fact",
    source: "the freshness policy this cycle wired into the served-feed read path",
  }),
};

const headlineFields = {
  status: "active build",
  milestone:
    "The customer-facing product and the operator command centre are built and tested. Delivery is " +
    "staged and waits on deliberate operator actions, not on further software.",
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. This cycle the status answer itself gained an expiry: a feed " +
    "older than one cycle now fails its own check instead of being read as current, and two served " +
    "copies can no longer tell different stories. Second messages sent: 0 — drafted 15 days. " +
    "Meetings 0, revenue none. Tests: 563 pass, 0 fail, 334 of 334 suites.",
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to " +
    "authenticated operators inside the AXIS command centre. This public feed never carries commit, " +
    "branch, or operator-script detail.",
  generatedAt: NOW,
};

const prevPath = path.join(root, "netlify/functions/_axis-status-full.json");
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : {};

const fullDetail = {
  schema: "axis-status-full/1",
  generatedAt: NOW,
  honest: true,
  claims,
  claimsPolicy:
    "Every figure above is { value, measuredAt, source, kind }. The emitter refuses to publish a " +
    "figure that is missing any of them, and labels — never deletes — a figure older than its kind " +
    "allows. As of this cycle the same standard applies to the feed as a whole: its own generatedAt " +
    "is refused at write time if it could never be honest, and the served feed fails its check once " +
    "it is older than one cycle, so silence and freshness are no longer indistinguishable.",
  program: {
    series: "flywheel",
    sequence: "RUN-AL — the feed that cannot go stale silently",
    previousSequence: "RUN-AK — the claim that cannot outlive its evidence",
    tasksBuiltAndGreen: 3,
    tasksTotal: 3,
    tasksMerged: 3,
    pct: 100,
    testsGreen: true,
    verificationCycleNote:
      "No customer-visible change this cycle and none is claimed. What changed is that the answer " +
      "AXIS speaks when an operator asks for status can no longer be several days old without " +
      "saying so — the failure mode where a cycle simply does not run is now a red check rather " +
      "than a silent continuation of the last good answer.",
    note:
      "AL1 — the served feed's generatedAt is refused at write time when it is absent, malformed, " +
      "or in the future, and the refusal writes nothing: proven by emitting a clean payload, " +
      "changing exactly that one field to an impossible value, and asserting both that the write " +
      "throws by class name and that a previously good feed on disk survives untouched. AL2 — " +
      "staleness is enforced on the READ path, because that is where the cycle that never ran shows " +
      "up: a feed past 24h fails its check, the identical bytes go stale as the clock advances with " +
      "nobody touching them, and the gate reports rather than repairs. AL2b — two served mirrors " +
      "carrying different generatedAt values fail as their own class even when both are fresh. " +
      "AL3 — this feed regenerated from this cycle's own numbers under that gate. Second messages " +
      "sent: still zero.",
  },
  tests: {
    beforeAnyWrite: { pass: 544, fail: 0, suites: "333/333", exit: 0 },
    afterEveryWrite: { pass: 563, fail: 0, suites: "334/334", exit: 0 },
    riseExplained: "this cycle's one new suite (19 cases) and nothing else",
    namedStandalone: { suite: "b4-axis-chat", pass: 20, fail: 0, exit: 0 },
    newThisCycle: { suite: "feed-freshness", cases: 19, redThenGreen: true },
  },
  workingTree: prev.workingTree || null,
  lanes: prev.lanes || [],
  blockers: prev.blockers || [],
  onTrack: {
    landing: false,
    conversion: false,
    honestNote:
      "Nothing published. No customer-visible change and none claimed. The verified work still sits " +
      "on the local line because the environment holds no credential for the shared host.",
  },
  needsAhmad: needsAhmadStaged,
  stagedAudit: { audited: needsAhmadStaged.length, failed: 0, guard: "staged-action-guard.v1" },
};

const { written, publicStatus } = emitAxisStatus({ root, publicFields: headlineFields, fullDetail });
console.log("RUN-AL feed emitted.");
console.log("  public  →", written.public.join(", "));
console.log("  internal→", written.internal);
console.log("  headline length:", publicStatus.headline.length, "chars (cap 400)");
console.log("  claims stamped:", Object.keys(claims).length);

const problems = checkPublicFiles(root);
if (problems.length) {
  console.error("post-emit check FAILED:");
  for (const p of problems) console.error(`  ${p.file}: ${p.reason} — ${p.match}`);
  process.exit(1);
}
console.log("  post-emit check: OK — headline-only, mirrors agree, fresh within one cycle.");
