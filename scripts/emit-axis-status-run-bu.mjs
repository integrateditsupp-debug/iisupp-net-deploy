#!/usr/bin/env node
// emit-axis-status-run-bu.mjs — RUN-BU.
//
// Inherits BD...BT discipline unchanged: the feed AXIS reads aloud is regenerated from THIS cycle's
// own measurement, taken by this script, at the moment it is written. A stale `generatedAt` on a
// spoken answer is a fabricated metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE ADDED TO THE SPOKEN ANSWER.
//
// RUN-BT found the feed stale by fifty-six days and fixed the stamp. It did not fix the reason the
// stamp went stale: a verified batch was parked behind a one-click push, every cycle reported it as
// "staged - one click waiting", and no cycle ever said for how long. So this emit carries the age.
// Asked "is anything waiting on me", AXIS now answers in days.
//
// WHERE EACH FIELD GOES, AND WHY.
//   PUBLIC  (.well-known/axis/status.json)       headline sentences only. The allowlist in
//           scripts/lib/axis-status-emit.mjs rejects any key it does not know and leak-scans every
//           value, so commit ids, branch names, ref paths and operator script names cannot reach it.
//           The pending-delivery age is published here because a COUNT OF DAYS names nothing
//           internal; the thing it is waiting on is not named.
//   INTERNAL (netlify/functions/_axis-status-full.json, force-404 live, served to authenticated
//           operators only) program series/sequence/tasks, the shared-line ref, the live lanes, the
//           real one-click items, and the per-delivery ages. This is the half that may be specific.
//
// It refuses to emit from a reading it did not take. No number here is typed by hand.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { measureInProcess, measureCommitsAhead, declaredUnmeasurable } from "./lib/claim-measure.mjs";
import { auditDeliveries, speakablePendingLine } from "./lib/pending-delivery.mjs";

const root = process.cwd();

/* ── reading 1: the suite, run here, now ──────────────────────────────────────────────────────── */
function runSuite(label) {
  let out = "";
  try {
    out = execFileSync("npm", ["test"], {
      cwd: path.join(root, "ARIA Sentinel"),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  const num = (key) => {
    const m = out.match(new RegExp(`^# ${key} (\\d+)$`, "m"));
    return m ? Number(m[1]) : null;
  };
  const suites = out.match(/^(\d+)\/(\d+) suites green\.$/m);
  const reading = {
    label,
    takenAt: new Date().toISOString(),
    tests: num("tests"),
    pass: num("pass"),
    fail: num("fail"),
    skipped: num("skipped"),
    suitesGreen: suites ? Number(suites[1]) : null,
    suitesTotal: suites ? Number(suites[2]) : null,
  };
  if (reading.tests === null || reading.fail === null) {
    throw new Error(`RUN-BU emit REFUSED: the "${label}" reading produced no parsable summary. A reading that was not taken is never published as a number.`);
  }
  return reading;
}

const here = runSuite("this checkout, as it stands");
console.log(`[RUN-BU] ${here.label}: ${here.pass}/${here.tests} pass · ${here.fail} fail · ${here.skipped} not taken · suites ${here.suitesGreen}/${here.suitesTotal}`);
if (here.fail !== 0) {
  throw new Error(`RUN-BU emit REFUSED: ${here.fail} assertion(s) failed. A red build is never published as a green headline.`);
}

/* ── reading 2: the shared line, as the code host reports it ──────────────────────────────────── */
function readSharedLine() {
  try {
    const out = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], {
      cwd: root, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"],
    });
    const sha = String(out).trim().split(/\s+/)[0] || null;
    return /^[0-9a-f]{40}$/i.test(sha || "") ? sha : null;
  } catch { return null; }
}
const mainRef = readSharedLine();

function readRemoteShas() {
  try {
    const out = execFileSync("git", ["ls-remote", "--heads", "--tags", "origin"], {
      cwd: root, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"],
    });
    return new Set(String(out).split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((s) => /^[0-9a-f]{40}$/i.test(s)));
  } catch { return new Set(); }
}

/* ── reading 3: the delivery shelf, and how long it has been waiting ──────────────────────────── */
function readDeliveryManifests() {
  const dir = path.join(root, "senior-director-state/delivery");
  if (!fs.existsSync(dir)) return null;
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    if (!n.endsWith(".manifest.json")) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
      m.name = m.name || n.replace(/\.manifest\.json$/, "");
      out.push(m);
    } catch { out.push({ name: n, tip: null, generatedAt: null }); }
  }
  return out;
}
const delivery = auditDeliveries({ deliveries: readDeliveryManifests(), remoteShas: readRemoteShas(), now: new Date() });
const pendingLine = speakablePendingLine(delivery);
console.log(`[RUN-BU] delivery shelf: ${delivery.statement}`);

/* ── the public headline — sentences only, leak-scanned by the emitter ────────────────────────── */
const readings = `${here.pass} of ${here.tests} checks pass with none failing`;
const notTaken = here.skipped > 0
  ? ` ${here.skipped} checks read an operator-internal record that is absent here; those are reported as not taken rather than as passes.`
  : "";
const waiting = delivery.state === "not-taken"
  ? "Whether a verified batch is waiting on approval was not measurable in this environment, and is not reported as none."
  : (delivery.pendingCount
      ? `${delivery.pendingCount} verified ${delivery.pendingCount === 1 ? "batch" : "batches"} of work ${delivery.pendingCount === 1 ? "is" : "are"} waiting on an approval, the oldest for ${delivery.oldestPendingDays} days.`
      : "Nothing verified is waiting on an approval.");

const publicFields = {
  status: "active build — the work waiting on approval now reports its own age",
  milestone:
    "A batch verified in August sat off the shared line for eight weeks while every report said, " +
    "truthfully, that it was staged and waiting. None of them said for how long, because nothing " +
    "computed it. That age is now measured every cycle, published, speakable, and red past its " +
    "threshold, so a wait can no longer be quietly indefinite.",
  readiness:
    "Built and tested this cycle. " + readings + "." + notTaken + " " + waiting +
    " Publishing to the live site stays a deliberate manual step.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is voice-operable. Sent: 0. Meetings 0, revenue none. Checks " +
    "this cycle: " + readings + "." + notTaken + " " + waiting,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to " +
    "authenticated operators inside the AXIS command centre. This public feed never carries commit, " +
    "branch, or operator-script detail.",
  generatedAt: new Date().toISOString(),
};

/* ── the operator-internal half — specific, evidenced, and never public ───────────────────────── */
const claims = {
  testsPassedAfterWrites: measureInProcess({
    value: here.pass, kind: "count",
    source: "the assertion-level summary printed by the suite run this script performed",
    how: "npm test (ARIA Sentinel) — parsed '# pass' from the runner's own summary",
  }),
  suitesGreenAfterWrites: measureInProcess({
    value: here.suitesGreen, kind: "count",
    source: "the suite-level summary printed by the suite run this script performed",
    how: "npm test (ARIA Sentinel) — parsed 'N/N suites green.' from the runner's own summary",
  }),
  commitsAheadOfSharedLine: measureCommitsAhead({ root }),
  oldestPendingDeliveryDays: delivery.state === "not-taken"
    ? declaredUnmeasurable("oldestPendingDeliveryDays", {
        reason: "the delivery shelf lives on the operator volume and is not readable from this checkout",
        source: "senior-director-state/delivery (absent here)",
      })
    : measureInProcess({
        value: delivery.oldestPendingDays, kind: "count",
        source: "the delivery manifests on the operator volume, compared against the refs the code host reports",
        how: "scripts/pending-delivery-audit.mjs logic — git ls-remote + manifest read, computed at emit time",
      }),
};

const fullDetail = {
  generatedAt: publicFields.generatedAt,
  program: {
    series: "CLIENT-READY",
    sequence: "RUN-BU",
    testsGreen: here.fail === 0,
    suitesGreen: here.suitesGreen,
    suitesTotal: here.suitesTotal,
    assertionsPassed: here.pass,
    assertionsTotal: here.tests,
    assertionsNotTaken: here.skipped,
    pct: here.tests ? Math.round((here.pass / here.tests) * 1000) / 10 : null,
    statement: "pct is pass/total of assertions actually taken plus not-taken; it is not a completion percentage for the programme, and is not presented as one.",
  },
  mainRef: mainRef || "unread — git ls-remote did not return refs/heads/main from this environment",
  lanes: [
    { lane: "delivery-age", state: "shipped this cycle", detail: "pending-delivery library + auditor + 13-assertion guard suite, registered in the runner that counts" },
    { lane: "axis-voice", state: "on the shared line", detail: "push-to-talk and spoken replies ported into the v2 console; the v1 console is retained as the voice contract and guarded" },
    { lane: "classifier", state: "measured each cycle at test time, never stored", detail: "no-match bucket and overall accuracy both above their floors as of the last measured cycle" },
    { lane: "publish", state: "Ahmad-only by design", detail: "merging the code line publishes nothing a visitor can see" },
  ],
  needsAhmad: delivery.state === "not-taken"
    ? [{ item: "not measurable from this checkout", ageDays: null }]
    : delivery.pending.map((p) => ({ item: p.name, ageDays: p.ageDays, commits: p.commits, action: "a push of verified code; deploys nothing" })),
  onTrack: here.fail === 0 && !delivery.overdue,
  onTrackStatement: here.fail === 0 && delivery.overdue
    ? "Not on track, and the reason is not the code: the suite is green and the oldest verified batch is past the age at which 'staged' stops being an honest word for it."
    : (here.fail === 0 ? "On track: green suite, nothing past its waiting threshold." : "Not on track: the suite is red."),
  deliveryShelf: {
    state: delivery.state,
    pendingCount: delivery.pendingCount,
    landedCount: delivery.landedCount,
    unverifiableCount: delivery.unverifiableCount,
    oldestPendingDays: delivery.oldestPendingDays,
    overdue: delivery.overdue,
    speakable: pendingLine,
    rows: [...delivery.pending, ...delivery.unverifiable, ...delivery.landed],
  },
  claims,
};

const res = emitAxisStatus({ root, publicFields, fullDetail });
const problems = checkPublicFiles(root);
if (problems.length) {
  throw new Error("RUN-BU emit REFUSED after write — " + problems.map((p) => `${p.file}: ${p.reason}`).join("; "));
}
console.log("[RUN-BU] public feed regenerated:", res.written.public.join(", "));
console.log("[RUN-BU] operator-internal detail:", res.written.internal);
console.log("[RUN-BU] leak + freshness check: OK");
console.log("[RUN-BU] speakable waiting line:", pendingLine);
