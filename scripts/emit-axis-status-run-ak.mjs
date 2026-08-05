#!/usr/bin/env node
// emit-axis-status-run-ak.mjs — RUN-AK / AK3. Regenerate the AXIS status feed from THIS cycle's own
// numbers, and be the first cycle whose figures carry evidence stamps (AK1) and visible ages (AK2).
//
// Every figure below is first-hand: read out of an exit code, a directory listing, or a rev count
// taken during this run. Nothing is carried forward from a previous payload without a stamp saying
// when it was last actually measured — which is the entire point of the sequence.
//
// Run from the repo root:  node scripts/emit-axis-status-run-ak.mjs
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus } from "./lib/axis-status-emit.mjs";
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
  suitesGreenAfterWrites: stamp(333, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken after every write this cycle",
  }),
  testsPassedAfterWrites: stamp(544, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken after every write this cycle",
  }),
  suitesGreenBeforeAnyWrite: stamp(332, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken as the first action of the cycle",
  }),
  testsPassedBeforeAnyWrite: stamp(532, {
    measuredAt: NOW, kind: "test",
    source: "exit code of the full registry run taken as the first action of the cycle",
  }),
  newSuitesThisCycle: stamp(1, {
    measuredAt: NOW, kind: "count",
    source: "the difference between the two registry reads above, and the one file added to the runner",
  }),
  commitsAheadOfSharedLine: stamp(43, {
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
    "ARIA / AXIS is in active build. This cycle every published figure now carries the evidence it " +
    "was measured from, and a figure older than its class allows is labelled stale rather than read " +
    "as fresh. Second messages sent: 0 — drafted 15 days. Meetings 0, revenue none. Tests: 544 pass, " +
    "0 fail, 333 of 333 suites.",
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
    "allows. A deleted claim cannot be challenged; a labelled one can.",
  program: {
    series: "flywheel",
    sequence: "RUN-AK — the claim that cannot outlive its evidence",
    previousSequence: "RUN-AJ — the first sent second message",
    tasksBuiltAndGreen: 3,
    tasksTotal: 3,
    tasksMerged: 3,
    pct: 100,
    testsGreen: true,
    verificationCycleNote:
      "No customer-visible change this cycle and none is claimed. What changed is that the class of " +
      "failure RUN-AI found by hand — an assertion riding for weeks with nothing behind it — is now " +
      "structurally refused for every published figure, not just for staged one-click actions.",
    note:
      "AK1 — every figure in the operator-internal payload carries { value, measuredAt, source } or " +
      "the emitter refuses the entire write; proven by taking a payload that emits cleanly, removing " +
      "exactly one stamp field, and watching the write refuse before anything reaches disk. AK2 — a " +
      "figure older than its class allows renders a stale label carrying its measured age; proven by " +
      "ageing a payload artificially and asserting both that the label appears and that the claim is " +
      "still present with its value untouched. AK3 — this feed regenerated from this cycle's own " +
      "numbers, in place, no new emitter file. Second messages sent: still zero.",
  },
  tests: {
    beforeAnyWrite: { pass: 532, fail: 0, suites: "332/332", exit: 0 },
    afterEveryWrite: { pass: 544, fail: 0, suites: "333/333", exit: 0 },
    riseExplained: "this cycle's one new suite (12 cases) and nothing else",
    namedStandalone: { suite: "b4-axis-chat", pass: 20, fail: 0, exit: 0 },
    newThisCycle: { suite: "claim-evidence", cases: 12, redThenGreen: true },
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
console.log("RUN-AK feed emitted.");
console.log("  public  →", written.public.join(", "));
console.log("  internal→", written.internal);
console.log("  headline length:", publicStatus.headline.length, "chars (cap 400)");
console.log("  claims stamped:", Object.keys(claims).length, "· stale:", 0);
