#!/usr/bin/env node
// emit-axis-status-run-ba.mjs — RUN-BA / BA4.
//
// Standing under AM1, AN2, AO3, AP4, AS4, AT4, AU4, AV4, AW4, AX4, AY4, AZ4: the AXIS status feed is
// regenerated from THIS cycle's own measurements, never from last cycle's prose. A stale
// `generatedAt` on a feed AXIS reads aloud is a fabricated metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE MEASURED, and why the feed says what it says.
//
// The cycle opened RED and the red was real. `deploy-safety-denylist` reported ten internal paths
// tracked by git in a repository whose publish dir is "." — which is to say ten operator files in
// every clone and in the live deploy. They were put there by RUN-AZ's own final two commits, after
// its last registry read, which is why RUN-AZ closed reporting "exit 0 after every write" in perfect
// good faith. The sentence was true of every write except the last one.
//
// Nothing in the feed below claims the leak "never shipped": the paths were tracked at HEAD from
// 34d8ef8 until this cycle's repair, and the only reason no stranger holds them is that nobody has
// published the line — which is a fact about a queue, not about a control. That distinction is the
// difference between an honest status feed and a comforting one.
//
// The registry number is READ from a run this script performs. It is not typed.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { parseRegistryOutput } from "./lib/claim-measure.mjs";

const root = process.cwd();

function measureRegistry() {
  const started = Date.now();
  let stdout = "", exitCode = 0;
  try {
    stdout = execFileSync("npm", ["test", "--silent"], {
      cwd: path.join(root, "ARIA Sentinel"), encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (err) {
    // A red registry must still be reportable. Refusing to look is not honesty.
    stdout = String(err.stdout || "");
    exitCode = typeof err.status === "number" ? err.status : 1;
  }
  return { ...parseRegistryOutput(stdout), exitCode, seconds: Math.round((Date.now() - started) / 1000) };
}

console.log("measuring: full registry (read, never typed) …");
const reg = measureRegistry();
const green = reg.fail === 0 && reg.exitCode === 0;
console.log(`  ${reg.pass} pass / ${reg.fail} fail / ${reg.suites}/${reg.suitesTotal} suites / exit ${reg.exitCode} (${reg.seconds}s)`);

// Measured, not remembered: how many internal paths are tracked right now, in BOTH senses.
const countInternal = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\n").filter((f) => f.startsWith("senior-director-state/") || f.startsWith("aria-vault/") || f.startsWith("documents/")).length;
const trackedInIndex = countInternal(["ls-files"]);
const trackedInHead = countInternal(["ls-tree", "-r", "--name-only", "HEAD"]);
console.log(`  internal paths tracked — index: ${trackedInIndex}, HEAD tree: ${trackedInHead}`);

if (trackedInIndex !== 0 || trackedInHead !== 0) {
  throw new Error(
    `RUN-BA / BA4 refuses to emit: ${trackedInIndex} internal path(s) in the index and ${trackedInHead} in HEAD's tree. ` +
    `A status feed published from a tree that still carries the leak this cycle exists to repair would be the ` +
    `exact class of claim this program refuses to make.`
  );
}

// The public feed is a HEADLINE. It carries no commit, no branch, no operator-script detail — that is
// enforced by the emitter's own allowlist and leak scan, not by this script's good intentions.
const publicFields = {
  status: green ? "active build" : "active build — registry red",
  milestone:
    "The customer-facing product and the operator command centre are built and tested. This cycle repaired a " +
    "packaging fault of its own making rather than adding surface: ten internal files had become tracked by the " +
    "last cycle's final commits, and the check that finds them ran one cycle too late to stop the write.",
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic. The internal-path " +
    "guard now refuses the commit instead of reporting it afterwards.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. This cycle opened on a real red and repaired it: ten internal files that the " +
    "previous cycle's last two commits had made tracked are tracked no longer, none deleted from disk, and the " +
    "guard moved from a report into a refusal. Sent: 0. Meetings 0, revenue none. " +
    `Tests: ${reg.pass} pass, ${reg.fail} fail, ${reg.suites}/${reg.suitesTotal} suites.`,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to authenticated " +
    "operators inside the AXIS command centre. This public feed never carries commit, branch, or operator-script detail.",
};

const res = emitAxisStatus({ root, publicFields });
const leaks = checkPublicFiles(root);
if (leaks.length) throw new Error(`RUN-BA / BA4: the emitted feed does not scan clean: ${JSON.stringify(leaks)}`);

console.log("wrote:", JSON.stringify(res.written, null, 2));
console.log("public mirrors scan clean:", leaks.length === 0);
console.log("generatedAt:", JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/axis/status.json"), "utf8")).generatedAt);
if (!green) process.exitCode = 1;
