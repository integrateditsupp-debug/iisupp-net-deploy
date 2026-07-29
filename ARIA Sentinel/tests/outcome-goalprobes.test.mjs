// STAGE 3 S2 (brain-audit F2) — outcome-level goalProbes. The audit finding, in one line: a spooler can
// be Running while printing still fails. Declaring "resolved" on service state is the false positive
// that made issues come back. These probes answer the USER's question instead.
// Invariants locked here: a probe that cannot run is pass:null (never a default pass), evidence is
// content-blind, and an unknown/ blocked probe never passes.
import assert from "node:assert/strict";
import { OUTCOME_PROBES, OUTCOME_PROBE_IDS, getOutcomeProbe, interpretOutcome, runOutcomeProbe } from "../src/main/outcome-probes.mjs";
import { validateTier0Command } from "../src/main/tier-0-executor.mjs";
import { PROBE_INTERPRETS, validateProbe } from "../src/shared/resolution-plan.mjs";
import { PLAYBOOKS } from "../src/main/resolution-playbooks.mjs";

// 1 — catalog: every probe is allowlisted, read-only in shape, and states what it proves.
assert.deepEqual([...OUTCOME_PROBE_IDS].sort(), ["audio-endpoint-active", "dns-resolves-known-host", "gateway-reachable", "print-queue-drains"]);
for (const id of OUTCOME_PROBE_IDS) {
  const p = OUTCOME_PROBES[id];
  assert.ok(validateTier0Command(p.command), `${id} command allowlisted`);
  assert.ok(PROBE_INTERPRETS.includes(p.interpret), `${id} interpret is a known plan interpret`);
  assert.ok(p.description.length > 20, `${id} says what it proves`);
  assert.deepEqual(validateProbe(getOutcomeProbe(id), id), [], `${id} is usable as a plan goalProbe`);
}
assert.equal(getOutcomeProbe("nope"), null);

// 2 — THE F2 CASE: the service is Running but the queue is still stuck ⇒ NOT resolved.
assert.equal(interpretOutcome("service-running", "Running"), true, "service state says everything is fine…");
assert.equal(interpretOutcome("count-zero", "3"), false, "…while 3 jobs are still stuck: not resolved");
assert.equal(interpretOutcome("count-zero", "0"), true);
assert.equal(interpretOutcome("count-positive", "0"), false);
assert.equal(interpretOutcome("bool-true", "True"), true);
assert.equal(interpretOutcome("bool-true", "False"), false);
assert.equal(interpretOutcome("vibes", "True"), false, "unknown interpret never passes");
assert.equal(interpretOutcome("count-zero", ""), false, "empty output never passes");

// 3 — the authored playbooks now declare OUTCOME probes, not service-state probes.
assert.equal(PLAYBOOKS["print-recovery"].goalProbe.outcomeProbeId, "print-queue-drains");
assert.equal(PLAYBOOKS["network-recovery"].goalProbe.outcomeProbeId, "dns-resolves-known-host");
assert.equal(PLAYBOOKS["audio-recovery"].goalProbe.outcomeProbeId, "audio-endpoint-active");
for (const id of Object.keys(PLAYBOOKS)) {
  assert.doesNotMatch(PLAYBOOKS[id].goalProbe.command, /^\(Get-Service [A-Za-z]+\)\.Status$/, `${id} goalProbe is no longer a bare service-status check`);
}

// 4 — live runs through an injected runner.
let r = await runOutcomeProbe("print-queue-drains", { run: async () => ({ stdout: "0", stderr: "", exitCode: 0 }), now: () => 7 });
assert.equal(r.pass, true);
assert.equal(r.evidence, "0");
assert.equal(r.ts, 7);

r = await runOutcomeProbe("print-queue-drains", { run: async () => ({ stdout: "4", stderr: "", exitCode: 0 }) });
assert.equal(r.pass, false, "jobs still stuck ⇒ honest failure");

// 5 — probe cannot run ⇒ pass:null. We do not KNOW it is fixed, so we never say it is.
for (const bad of [
  async () => ({ stdout: "", stderr: "boom", exitCode: 1 }),
  async () => { throw new Error("no powershell"); },
  async () => ({ stdout: "", stderr: "", exitCode: 0 })
]) {
  const res = await runOutcomeProbe("gateway-reachable", { run: bad });
  assert.equal(res.pass, null, "unavailable probe is null, never true");
  assert.notEqual(res.pass, true);
  assert.equal(res.reason, "probe-unavailable");
}
assert.equal((await runOutcomeProbe("nope", { run: async () => ({ stdout: "0", exitCode: 0 }) })).pass, null);

// 6 — content-blind: a private-folder path in stdout is redacted at the source.
r = await runOutcomeProbe("dns-resolves-known-host", {
  run: async () => ({ stdout: "2\nC:\\Users\\a\\Private pics and Vids\\x.png", stderr: "", exitCode: 0 })
});
assert.equal(r.pass, true, "the real count is still readable after redaction");
assert.doesNotMatch(r.evidence, /private\s+pics/i, "R11: the private folder never reaches evidence");
assert.match(r.evidence, /<private-folder>/);

console.log("outcome-goalprobes test passed (F2: user outcome ≠ service state · unavailable is null never pass · unknown interpret never passes · evidence content-blind · playbooks use outcome probes).");
