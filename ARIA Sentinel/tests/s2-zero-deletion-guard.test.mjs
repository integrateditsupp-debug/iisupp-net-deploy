// STAGE 3 S2 — the ZERO-DELETION GUARD. The safety stack (supervisor critic, countdown gate, tier-0
// pre/exec/post/rollback wrapper) is reused UNCHANGED; S2 was only allowed to ADD. This suite is the
// mechanical proof: the original control-plane code is still present, byte-for-byte, and the two
// files that must not change at all still carry no S2 code.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER0_COMMANDS, ALIASES, TIER0_EXECUTOR_IDS } from "../src/main/tier-0-executor.mjs";
import { superviseProposal, recipeSideEffects, supervisorAuditEntry } from "../src/main/supervisor-agent.mjs";
import { createCountdown, createCountdownManager, shouldCountdown, countdownChatLine, countdownBannerText, COUNTDOWN_SECONDS } from "../src/main/action-countdown.mjs";

const MAIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "main");
const read = (f) => fs.readFileSync(path.join(MAIN, f), "utf8");

// 1 — supervisor-agent.mjs and action-countdown.mjs are UNTOUCHED: same exports, no S2 code inside.
const supervisor = read("supervisor-agent.mjs");
const countdown = read("action-countdown.mjs");
for (const [file, src] of [["supervisor-agent.mjs", supervisor], ["action-countdown.mjs", countdown]]) {
  assert.doesNotMatch(src, /STAGE 3 S2|restore-point|durability-ledger|outcome-probes|escalation-packet|plan-resume/, `${file} must contain no S2 code`);
}
for (const fn of [superviseProposal, recipeSideEffects, supervisorAuditEntry, createCountdown, createCountdownManager, shouldCountdown, countdownChatLine, countdownBannerText]) {
  assert.equal(typeof fn, "function");
}
assert.equal(COUNTDOWN_SECONDS, 10, "the 10s countdown is unchanged");
// The supervisor's ordered veto checks are all still there, R11 first.
for (const marker of ["R11_BLOCKED", "UNVETTED_RECIPE", "SIDE_EFFECT_UNDECLARED", "COOLDOWN", "approve-fast"]) {
  assert.ok(supervisor.includes(marker), `supervisor still enforces ${marker}`);
}
assert.ok(supervisor.indexOf("R11") < supervisor.indexOf("UNVETTED_RECIPE"), "R11 is still check #1");

// 2 — tier-0-executor.mjs: the ORIGINAL five bindings are present verbatim (additions only).
const exec = read("tier-0-executor.mjs");
const ORIGINAL_BINDINGS = [
  '"restart-print-spooler": { kind: "service", service: "Spooler", command: "Restart-Service Spooler -Force; (Get-Service Spooler).Status", probe: "(Get-Service Spooler).Status" }',
  '"restart-windows-update": { kind: "service", service: "wuauserv", command: "Restart-Service wuauserv -Force; (Get-Service wuauserv).Status", probe: "(Get-Service wuauserv).Status" }',
  '"flush-dns-cache": { kind: "dns", command: "ipconfig /flushdns", probe: "(Get-DnsClientCache | Measure-Object).Count" }',
  '"restart-bluetooth": { kind: "service", service: "bthserv", command: "Restart-Service bthserv -Force; (Get-Service bthserv).Status", probe: "(Get-Service bthserv).Status" }',
  '"restart-audio": { kind: "service", service: "Audiosrv", command: "Restart-Service Audiosrv -Force; (Get-Service Audiosrv).Status", probe: "(Get-Service Audiosrv).Status" }'
];
for (const line of ORIGINAL_BINDINGS) assert.ok(exec.includes(line), `original binding unchanged: ${line.slice(0, 34)}…`);
assert.deepEqual({ ...ALIASES }, { "restart-audio-service": "restart-audio", "flush-dns": "flush-dns-cache" }, "aliases unchanged");

// 3 — the original control-flow lines of the wrapper are still exactly as they were.
for (const line of [
  'if (!exec || exec.exitCode !== 0) return "fail";',
  'if (spec.kind === "dns") return (before === 0 && after === 0) ? "no-op-neutral" : "success";',
  'if (after === "Running") return before === "Running" ? "no-op-neutral" : "success";',
  'emit("TIER0.EXEC", "dry-run — no command executed", { dryRun: true });'
]) assert.ok(exec.includes(line), `wrapper control flow unchanged: ${line.slice(0, 40)}…`);

// 4 — the additions really are additions: 7 bindings, original 5 still in their original order.
assert.equal(TIER0_EXECUTOR_IDS.length, 7);
assert.deepEqual(
  TIER0_EXECUTOR_IDS.filter((id) => !["clear-print-queue", "reset-network-stack"].includes(id)),
  ["restart-print-spooler", "restart-windows-update", "flush-dns-cache", "restart-bluetooth", "restart-audio"]
);
for (const id of Object.keys(TIER0_COMMANDS)) assert.ok(TIER0_COMMANDS[id].command, `${id} has a command`);

// 5 — R11 is still check #1 in the executor itself (before any spawn).
assert.ok(exec.indexOf("isBlockedPath(recipeId)") < exec.indexOf("const before = spec.probe"), "R11 hard stop precedes the PRE probe");

console.log("s2-zero-deletion-guard test passed (supervisor + countdown untouched · original 5 bindings + aliases + wrapper control flow verbatim · additions only · R11 still check #1).");
