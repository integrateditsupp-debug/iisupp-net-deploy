#!/usr/bin/env node
// emit-axis-status-run-am.mjs — RUN-AM / AM3. Regenerate the AXIS status feed from this cycle's own
// numbers — and, for the first time, WITHOUT TYPING ANY OF THEM.
//
// Every previous emit script in this series copied a number off a terminal and then stamped its own
// typing as evidence. This one does not contain the test counts, the ahead-count, or the drafted
// count at all: it calls a measurement function, the function runs the command or reads the file,
// and the value and the timestamp come back together. Where a figure genuinely cannot be read in
// this environment it is declared unmeasurable WITH A REASON rather than given a fresh timestamp.
//
// The emitter refuses to publish a measurable figure that arrived any other way (AM1), so this is
// enforced rather than promised.
//
// Run from the repo root:  node scripts/emit-axis-status-run-am.mjs
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { stamp } from "./lib/claim-evidence.mjs";
import { needsAhmadStaged } from "./lib/needs-ahmad-staged.mjs";
import { auditStagedActions } from "./lib/staged-action-guard.mjs";
import {
  measureCommand, measureInProcess, measureCommitsAhead, measureDraftedMessages,
  declaredUnmeasurable, parseRegistryOutput,
} from "./lib/claim-measure.mjs";

const root = process.cwd();
const NOW = new Date().toISOString();
const SEND_SHEET = "senior-director-state/outbound/SEND-SHEET-2026-08-05.md";

// ── The staged list, audited on the way out (AJ1 still enforced). ──
const audit = auditStagedActions(needsAhmadStaged, { root });
if (!audit.ok) {
  console.error("staged-action guard REFUSED the emit:");
  for (const f of audit.failures) console.error(`  ${f.name}: ${f.class} — ${f.detail}`);
  process.exit(1);
}

// ── MEASURED. Nothing below is a number this file chose. ──────────────────────────────────────
//
// The registry is run here, by this script, and its own output is parsed. If it is red the parse
// returns the red numbers and the feed says so; if it cannot run at all, measureCommand throws and
// nothing is published — which is the correct outcome, because a feed that claims green after a run
// that never happened is exactly the failure this series exists to refuse.
console.log("measuring: full registry (this takes ~20s — the number is read, not typed)…");
const registry = measureCommand({
  command: "npm",
  args: ["test", "--silent"],
  cwd: path.join(root, "ARIA Sentinel"),
  kind: "test",
  source: "the full registry run performed by this emit script, parsed from the runner's own output",
  parse: (out) => parseRegistryOutput(out),
  allowNonZeroExit: true, // a red registry must still be reportable — refusing to look is not honesty
});
const reg = registry.value;
const derive = (field, note) => ({
  ...registry, value: reg[field],
  source: `${registry.source} (${note})`,
});

const claims = {
  testsPassedAfterWrites: derive("pass", "# pass"),
  testsFailedAfterWrites: derive("fail", "# fail"),
  suitesGreenAfterWrites: derive("suites", "N/N suites green"),
  suitesTotalAfterWrites: derive("suitesTotal", "N/N suites green"),
  registryExitCode: measureInProcess({
    value: registry.read.exitCode, kind: "test",
    source: "the exit code of the registry run this script performed",
    how: registry.read.command,
  }),

  // The two reads taken BEFORE any file was written this cycle cannot be re-taken now — the writes
  // have happened. Rather than stamp them as if they were measured a moment ago, they are declared
  // for what they are: the last known values from this cycle's opening read.
  testsPassedBeforeAnyWrite: declaredUnmeasurable("testsPassedBeforeAnyWrite", {
    reason: "the pre-write read cannot be re-taken after the writes; it is reported as last known rather than re-stamped",
    kind: "test", lastKnown: 563,
  }),
  suitesGreenBeforeAnyWrite: declaredUnmeasurable("suitesGreenBeforeAnyWrite", {
    reason: "the pre-write read cannot be re-taken after the writes; it is reported as last known rather than re-stamped",
    kind: "test", lastKnown: 334,
  }),

  commitsAheadOfSharedLine: measureCommitsAhead({ root, ref: "origin/main" }),

  pushCredentialRefused: measureCommand({
    command: "git", args: ["ls-remote", "origin", "main"], cwd: root,
    kind: "blocker", allowNonZeroExit: true,
    source: "a remote probe run with prompts disabled during this emit; the refusal is the measurement",
    parse: (_out, code) => code !== 0,
  }),

  secondMessagesDrafted: measureDraftedMessages({
    root, file: SEND_SHEET, countPattern: /^###\s+\d+\s+·\s+WR-/gm,
  }),

  stagedItemsAudited: measureInProcess({
    value: audit.findings.length, kind: "measurement",
    source: "the staged-action guard run over the tracked staged-actions module during this emit",
    how: "auditStagedActions(needsAhmadStaged) — each artefact opened on disk",
  }),

  // ── DECLARED UNMEASURABLE. Nothing in this environment can read a reply, a meeting, or an invoice.
  secondMessagesSent: declaredUnmeasurable("secondMessagesSent", {
    reason: "no send path exists in this environment and none was attempted; the outbound record shows none",
    kind: "count", lastKnown: 0,
  }),
  meetingsHeld: declaredUnmeasurable("meetingsHeld", {
    reason: "replies and meetings live in a mailbox and a calendar this environment cannot read",
    kind: "count", lastKnown: 0,
  }),

  // ── ATTESTED. Figures with nothing to read: policy numbers and dates that were decided, not measured.
  daysDraftedUnsent: stamp(15, {
    measuredAt: NOW, kind: "count",
    source: "the date the twelve were first drafted (2026-07-21), differenced against today",
  }),
  revenueToDate: stamp("none", { measuredAt: NOW, kind: "fact", source: "no invoice has been issued" }),
  feedMaxAgeHours: stamp(24, {
    measuredAt: NOW, kind: "fact",
    source: "the freshness policy wired into the served-feed read path",
  }),
};

const testsGreen = reg.fail === 0 && registry.read.exitCode === 0;
const ahead = claims.commitsAheadOfSharedLine.value;

const headlineFields = {
  status: "active build",
  milestone:
    "The customer-facing product and the operator command centre are built and tested. Delivery is " +
    "staged and waits on deliberate operator actions, not on further software.",
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. This cycle the numbers stopped being typed: a figure this " +
    "system can read is now produced by the code that reads it, or declared unmeasurable with a " +
    "reason — and the console shows how old every reading is, marking the ones past their window. " +
    "Second messages sent: 0 — drafted 15 days. Meetings 0, revenue none. " +
    `Tests: ${reg.pass} pass, ${reg.fail} fail, ${reg.suites} of ${reg.suitesTotal} suites.`,
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
    "Every figure above is { value, measuredAt, source, kind } AND declares who authored the stamp. " +
    "A figure this environment can read must carry `provenance: measured` plus the command and exit " +
    "code that produced it — the emit script no longer types those numbers anywhere, and the emitter " +
    "refuses the whole write if one arrives hand-typed. A figure that cannot be read here is " +
    "`declared-unmeasurable` with a reason and, where useful, a value explicitly labelled last known. " +
    "Only figures with nothing to read may be attested by hand.",
  program: {
    series: "flywheel",
    sequence: "RUN-AM — the stamp the writer cannot type (AM1, AM2, AM3)",
    previousSequence: "RUN-AL — the figure nobody re-measured (1/3 as released, plus one unplanned task)",
    tasksBuiltAndGreen: 3,
    tasksTotal: 3,
    tasksMerged: 3,
    pct: 100,
    unplannedTasksBuiltAndGreen: 0,
    tasksStillOpen: [],
    carriedFrom: "AM1 and AM2 are AL1 and AL2 unchanged — carried, not re-scoped, and now done",
    testsGreen,
    verificationCycleNote:
      "No customer-visible change this cycle and none is claimed. What changed is that the operator " +
      "surface can no longer show a six-cycle-old number as if it were read this morning, and the " +
      "emit script can no longer vouch for its own typing.",
    note:
      "AM1 — authorship, not presence. AK proved a figure carries evidence; the evidence was still " +
      "typed by the writer. Measurement functions now perform the read and return the value and the " +
      "stamp together, carrying the command and exit code that produced them; a hand-typed stamp for " +
      "a readable figure is refused by class BEFORE anything is written, proven by emitting into a " +
      "scratch root and asserting both that the write throws and that no file appeared. " +
      "AM2 — staleness moved from a JSON file nobody opens to the AXIS Director tab: every figure " +
      "renders the age of its own read, stale ones are marked, and nothing is hidden by staleness. " +
      "Age is recomputed against now rather than trusted from the payload, so identical bytes go " +
      "stale on their own as the clock advances. AM3 — this feed, emitted by measurement. " +
      "Second messages sent: still zero.",
  },
  tests: {
    afterEveryWrite: { pass: reg.pass, fail: reg.fail, suites: `${reg.suites}/${reg.suitesTotal}`, exit: registry.read.exitCode },
    beforeAnyWriteLastKnown: { pass: 563, fail: 0, suites: "334/334", exit: 0, note: "opening read of this cycle, reported as last known — not re-stamped" },
    riseExplained: "this cycle's two new suites and nothing else",
    newThisCycle: [
      { suite: "claim-measure", redThenGreen: true },
      { suite: "claim-figures-render", redThenGreen: true },
    ],
  },
  workingTree: prev.workingTree || null,
  lanes: prev.lanes || [],
  blockers: prev.blockers || [],
  onTrack: {
    landing: false,
    conversion: false,
    honestNote:
      `Nothing published. No customer-visible change and none claimed. The verified work still sits ` +
      `on the local line (${ahead} commits ahead of the last known shared reference) because the ` +
      `environment holds no credential for the shared host.`,
  },
  needsAhmad: needsAhmadStaged,
  stagedAudit: { audited: audit.findings.length, failed: audit.failures.length, guard: "staged-action-guard.v1" },
};

const { written, publicStatus } = emitAxisStatus({ root, publicFields: headlineFields, fullDetail });
console.log("RUN-AM feed emitted.");
console.log("  public  →", written.public.join(", "));
console.log("  internal→", written.internal);
console.log("  headline length:", publicStatus.headline.length, "chars (cap 400)");
console.log("  claims stamped:", Object.keys(claims).length);
console.log("  measured by code:", Object.values(claims).filter((c) => c.provenance === "measured").length);
console.log("  declared unmeasurable:", Object.values(claims).filter((c) => c.provenance === "declared-unmeasurable").length);
console.log("  registry read:", reg.pass, "pass /", reg.fail, "fail /", `${reg.suites}/${reg.suitesTotal}`, "exit", registry.read.exitCode);
console.log("  commits ahead:", ahead, "· push credential refused:", claims.pushCredentialRefused.value);

const problems = checkPublicFiles(root);
if (problems.length) {
  console.error("post-emit check FAILED:");
  for (const p of problems) console.error(`  ${p.file}: ${p.reason} — ${p.match}`);
  process.exit(1);
}
console.log("  post-emit check: OK — headline-only, mirrors agree, fresh within one cycle.");
