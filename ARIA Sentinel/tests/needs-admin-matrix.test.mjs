// PROD 2026-10-14 (audit M3 / M5) — HONEST ELEVATION.
//
// The app runs as the signed-in user (UAC split token even for administrators). Every service restart,
// `ipconfig /release`, `Checkpoint-Computer` and `Update-MpSignature` therefore fails unelevated — and the Tier-0
// executor used to call a refused restart "No change needed (already healthy)" because the trailing read-only
// statement exited 0. This suite pins the whole matrix:
//   · every executor binding / registry action whose command needs admin carries needsAdmin:true;
//   · no command anywhere targets the Dnscache service (unstoppable on Windows 10 1809+ / 11);
//   · the spawned command carries `if(-not $?){exit 1}` right after the remediation statement;
//   · stderr "access is denied / cannot open / PermissionDenied / cannot be stopped" → fail + reason needs-admin;
//   · a needsAdmin binding routes its EXEC through the injected elevated runner (probes stay unelevated), and with
//     elevation declared unavailable it is NOT attempted (outcome needs-admin);
//   · the elevated spawn is Start-Process -Verb RunAs with an -EncodedCommand (no shell re-interpretation);
//   · describeDecision says "needs administrator approval (UAC)" where true, and the unattended refusal names the
//     admin runner that is not registered;
//   · main.mjs never calls runElevated from an unattended path.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TIER0_COMMANDS, TIER0_EXECUTOR_IDS, NEEDS_ADMIN_RE, ACCESS_DENIED_RE, UNSTOPPABLE_SERVICES,
  guardedCommand, validateTier0Command, classifyOutcome, executeTier0, executorNeedsAdmin, commandNeedsAdmin
} from "../src/main/tier-0-executor.mjs";
import { actionNeedsAdmin, recipeHasAdminStep, buildElevatedExecution, UAC_CANCELLED_EXIT } from "../src/shared/recipe-runner.mjs";
import { RECIPES, recipeById } from "../src/shared/recipes.mjs";
import { recipes as TIER0_CATALOG } from "../src/main/recipes/tier-0/catalog.mjs";
import { describeDecision } from "../src/shared/approval-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
let groups = 0; const g = () => { groups++; };

// 1 — every executor binding whose command matches the admin shape says needsAdmin:true (and only those).
for (const id of TIER0_EXECUTOR_IDS) {
  const spec = TIER0_COMMANDS[id];
  const shape = NEEDS_ADMIN_RE.test(spec.command);
  assert.equal(Boolean(spec.needsAdmin), shape, `${id}: needsAdmin matches its command shape (${spec.command})`);
  assert.equal(executorNeedsAdmin(id), shape);
}
assert.equal(executorNeedsAdmin("flush-dns-cache"), false, "ipconfig /flushdns needs no admin");
assert.equal(executorNeedsAdmin("restart-print-spooler"), true);
assert.equal(executorNeedsAdmin("restart-audio-service"), true, "alias resolves");
assert.equal(executorNeedsAdmin("nope"), false);
g();

// 2 — every registry recipe action whose command needs admin is flagged needsAdmin:true; every flagged one really needs it.
let flagged = 0;
for (const r of RECIPES) {
  for (const a of r.actions || []) {
    if (a.shell !== "powershell") continue;
    const shape = NEEDS_ADMIN_RE.test(String(a.command || ""));
    if (shape) { assert.equal(a.needsAdmin, true, `${r.id}/${a.id} needs admin and must say so: ${a.command}`); flagged++; }
    if (a.needsAdmin === true) assert.ok(shape, `${r.id}/${a.id} is flagged needsAdmin but its command does not need it: ${a.command}`);
    assert.equal(actionNeedsAdmin(a), shape, `${r.id}/${a.id} actionNeedsAdmin agrees with the shape`);
  }
}
assert.ok(flagged >= 15, `at least 15 admin steps across the registry (got ${flagged})`);
assert.equal(recipeHasAdminStep(recipeById("printer-spooler-v1")), true);
assert.equal(recipeHasAdminStep(recipeById("dns-fail-v1")), false, "dns-fail-v1 is fully user-space now");
assert.equal(commandNeedsAdmin("Checkpoint-Computer -Description 'x'"), true);
assert.equal(commandNeedsAdmin("ipconfig /release; ipconfig /renew"), true);
assert.equal(commandNeedsAdmin("ipconfig /flushdns"), false);
assert.equal(commandNeedsAdmin("Get-Service Spooler"), false);
g();

// 3 — no command, probe or catalog step targets Dnscache; the user-space replacements are in place.
assert.deepEqual(UNSTOPPABLE_SERVICES, ["Dnscache"]);
for (const id of TIER0_EXECUTOR_IDS) {
  assert.doesNotMatch(TIER0_COMMANDS[id].command, /dnscache/i, `${id} command never targets Dnscache`);
}
for (const r of RECIPES) for (const a of r.actions || []) assert.doesNotMatch(String(a.command || ""), /Restart-Service[^;]*Dnscache|Stop-Service[^;]*Dnscache/i, `${r.id}/${a.id} never restarts Dnscache`);
for (const [id, rec] of Object.entries(TIER0_CATALOG)) for (const c of rec.commands || []) assert.doesNotMatch(c, /dnscache/i, `tier-0 catalog ${id} never targets Dnscache`);
const dns = recipeById("dns-fail-v1");
assert.deepEqual(dns.actions.map((a) => a.command), ["ipconfig /flushdns", "ipconfig /registerdns", "Clear-DnsClientCache"], "dns-fail-v1 = flush + registerdns + Clear-DnsClientCache");
assert.equal(dns.actions.every((a) => !a.needsAdmin), true, "none of them needs admin");
const svcDns = recipeById("svc-dnscache-stopped-v1");
assert.ok(svcDns, "the svc-dnscache recipe id is preserved (Rule 15)");
assert.doesNotMatch(svcDns.actions.map((a) => a.command).join(";"), /Restart-Service/i, "…but it no longer tries the impossible restart");
assert.match(svcDns.summary, /cannot be restarted/i, "…and says why");
const ps1 = fs.readFileSync(path.join(root, "src/recipes/scripts/dns-reregister.ps1"), "utf8");
assert.doesNotMatch(ps1, /^Restart-Service Dnscache/m, "the .ps1 mirror dropped the Dnscache restart too");
assert.match(ps1, /^Clear-DnsClientCache/m);
g();

// 4 — the exit guard sits right after the remediation statement and stays allow-listed.
assert.equal(guardedCommand("Restart-Service Spooler -Force; (Get-Service Spooler).Status"), "Restart-Service Spooler -Force; if(-not $?){exit 1}; (Get-Service Spooler).Status");
assert.equal(guardedCommand("ipconfig /flushdns"), "ipconfig /flushdns; if(-not $?){exit 1}");
for (const id of TIER0_EXECUTOR_IDS) assert.ok(validateTier0Command(guardedCommand(TIER0_COMMANDS[id].command)), `${id}: guarded command still passes the allowlist`);
assert.equal(validateTier0Command("Restart-Service Spooler; if($true){Remove-Item C:\\}"), false, "an arbitrary `if` statement is NOT the guard and is rejected");
g();

// 5 — classify: a denied restart with exit 0 (the masked case) is a FAIL with reason needs-admin — never "healthy".
const spoolerSpec = TIER0_COMMANDS["restart-print-spooler"];
assert.deepEqual(classifyOutcome(spoolerSpec, "Running", "Running", { exitCode: 0, stderr: "Restart-Service : Cannot open Spooler service on computer '.'." }), { verdict: "fail", reason: "needs-admin" });
assert.deepEqual(classifyOutcome(spoolerSpec, "Running", "Running", { exitCode: 0, stderr: "" }), { verdict: "no-op-neutral", reason: "" }, "a clean exit 0 with no change is still neutral");
assert.deepEqual(classifyOutcome(spoolerSpec, "Stopped", "Running", { exitCode: 0, stderr: "" }), { verdict: "success", reason: "" });
assert.deepEqual(classifyOutcome(spoolerSpec, "Running", "Running", { exitCode: 1, stderr: "" }), { verdict: "fail", reason: "exit-code" });
for (const s of ["Access is denied", "cannot open wuauserv service", "PermissionDenied", "Service 'Spooler' cannot be stopped due to the following error"]) assert.ok(ACCESS_DENIED_RE.test(s), `denial shape: ${s}`);
// End-to-end through the executor: injected runner returns exit 0 + a denial on stderr + "Running" state.
const denied = async (cmd) => (/^Restart-Service/i.test(cmd) ? { exitCode: 0, stderr: "Cannot open Spooler service", stdout: "Running" } : { exitCode: 0, stderr: "", stdout: "Running" });
let r = await executeTier0("restart-print-spooler", { run: denied });
assert.equal(r.outcome, "fail");
assert.equal(r.reason, "needs-admin");
assert.equal(r.needsAdmin, true);
assert.match(r.message, /administrator/i, "the message says administrator");
assert.doesNotMatch(r.message, /healthy/i, "…and never 'already healthy'");
assert.equal(r.rolledBack, false, "nothing to roll back — the change never started");
g();

// 6 — routing: a needsAdmin binding runs its EXEC (and only its EXEC) through the injected elevated runner.
const seen = { plain: [], elevated: [] };
let status = "Stopped";
const plainRun = async (cmd) => { seen.plain.push(cmd); return { exitCode: 0, stderr: "", stdout: status }; };
const elevatedRun = async (cmd) => { seen.elevated.push(cmd); status = "Running"; return { exitCode: 0, stderr: "", stdout: "" }; };
r = await executeTier0("restart-print-spooler", { run: plainRun, runElevated: elevatedRun });
assert.equal(r.outcome, "success");
assert.equal(seen.elevated.length, 1, "exactly one elevated spawn (the remediation)");
assert.match(seen.elevated[0], /^Restart-Service Spooler -Force; if\(-not \$\?\)\{exit 1\}/, "the elevated command is the guarded remediation");
assert.ok(seen.plain.every((c) => /^\(Get-Service/.test(c)), "the plain runner only ever ran read-only probes");
assert.ok(r.events.some((e) => e.event === "TIER0.EXEC" && e.elevated === true), "the audit event records the elevation");
// flush-dns-cache never asks for elevation even when an elevated runner is offered.
seen.plain.length = 0; seen.elevated.length = 0;
let dnsCount = 5;
const dnsPlain = async (cmd) => { seen.plain.push(cmd); if (/flushdns/i.test(cmd)) dnsCount = 0; return { exitCode: 0, stderr: "", stdout: String(dnsCount) }; };
r = await executeTier0("flush-dns-cache", { run: dnsPlain, runElevated: elevatedRun });
assert.equal(r.outcome, "success");
assert.equal(seen.elevated.length, 0, "no UAC for a user-space fix");
// Elevation declared unavailable (unattended) → NOT attempted, outcome needs-admin, nothing spawned for the change.
seen.plain.length = 0;
r = await executeTier0("restart-print-spooler", { run: plainRun, elevated: false });
assert.equal(r.outcome, "needs-admin");
assert.ok(seen.plain.every((c) => /^\(Get-Service/.test(c)), "only the PRE probe ran");
assert.match(r.message, /administrator approval \(UAC\)/i);
// A declined UAC prompt is reported as declined, not as a generic failure.
r = await executeTier0("restart-print-spooler", { run: plainRun, runElevated: async () => ({ exitCode: UAC_CANCELLED_EXIT, stderr: "", stdout: "", reason: "uac-denied" }) });
assert.equal(r.outcome, "fail");
assert.equal(r.reason, "uac-denied");
assert.match(r.message, /declined/i);
// Dry-run of an admin binding says the real run will ask for UAC.
r = await executeTier0("restart-print-spooler", { dryRun: true, run: plainRun });
assert.equal(r.outcome, "dry-run");
assert.match(r.message, /administrator approval \(UAC\)/i);
g();

// 7 — the elevated spawn shape: outer non-elevated PowerShell → Start-Process -Verb RunAs → inner -EncodedCommand.
const ex = buildElevatedExecution("Restart-Service Spooler -Force; if(-not $?){exit 1}");
assert.equal(ex.file, "powershell.exe");
assert.deepEqual(ex.args.slice(0, 5), ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command"]);
assert.match(ex.args[5], /Start-Process -FilePath 'powershell\.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ErrorAction Stop/);
assert.match(ex.args[5], /'-NonInteractive','-ExecutionPolicy','Restricted','-EncodedCommand'/, "the inner session is NonInteractive + Restricted");
assert.equal(Buffer.from(ex.encodedCommand, "base64").toString("utf16le"), "Restart-Service Spooler -Force; if(-not $?){exit 1}", "the encoded command round-trips exactly");
assert.ok(!ex.args[5].includes("Restart-Service"), "the raw command never travels unencoded through the outer command line");
assert.match(ex.args[5], new RegExp(`exit \\$p\\.ExitCode \\} catch \\{ exit ${UAC_CANCELLED_EXIT} \\}`), "a declined prompt exits 1223");
g();

// 8 — the copy: attended execute names the UAC prompt; unattended becomes an approval request that names the admin runner.
assert.match(describeDecision({ action: "execute", needsAdmin: true }), /needs administrator approval \(UAC\)/i);
assert.match(describeDecision({ action: "execute", needsAdmin: true, requiresRestorePoint: true }), /UAC[\s\S]*restore point/i);
assert.doesNotMatch(describeDecision({ action: "execute" }), /UAC/, "no UAC talk for a user-space fix");
assert.match(describeDecision({ action: "request-approval", reason: "needs-admin-unattended" }), /unattended fixes need the admin runner \(not registered\)/i);
assert.match(describeDecision({ action: "request-approval", reason: "needs-admin-unavailable" }), /cannot request/i);
g();

// 9 — main.mjs wiring (source-level): runElevated exists, refuses unattended use, allow-lists, and is only handed to
//     the executor / runAction when the gate said a person is present; the unattended path becomes an approval.
assert.match(main, /function runElevated\(command, \{ attended = false/, "runElevated requires an explicit attended flag");
assert.match(main, /if \(attended !== true\) return resolve\(\{[^}]*reason: "unattended-elevation-refused"/, "unattended use is refused inside the runner itself");
assert.match(main, /if \(!\(isAllowedCommand\(cmd\) \|\| validateTier0Command\(cmd\)\)\) return resolve/, "only allow-listed commands can be elevated");
assert.match(main, /buildElevatedExecution\(cmd\)/, "the spawn shape comes from the tested builder");
assert.match(main, /runElevated: attended \? \(cmd\) => runElevated\(cmd, \{ attended: true \}\) : undefined/, "the executor gets the elevated runner only when attended");
assert.match(main, /elevated: attended \? undefined : false/, "…and is told elevation is unavailable otherwise");
assert.match(main, /const needsAdmin = !policy\.dryRun && recipeNeedsAdmin\(recipeId\);/, "the gate knows which fixes need admin");
assert.match(main, /decision = \{ \.\.\.decision, action: "request-approval", reason, needsAdmin: true, elevation/, "an unattended admin fix becomes an approval request");
assert.match(main, /const elevationFor = \(humanInitiated \|\| approved\) && color !== "red" \? elevation : "none";/, "red / unattended never get an elevation token");
assert.match(main, /if \(actionNeedsAdmin\(action\)\) \{\s*\n\s*if \(gate\.elevation !== "uac"\)/, "runAction refuses an admin step without the attended token");
assert.match(main, /runElevated\(guardedRecipeCommand\(action\.command\), \{ attended: true \}\)/, "…and elevates it with the guard when attended");
assert.match(main, /access is denied\|cannot open\|PermissionDenied\|cannot be stopped/i, "runAction classifies a denial on stderr too");
assert.match(main, /dryRun: true, elevation: "none"/, "the direct run-recipe channel carries no elevation");
assert.doesNotMatch(main, /runElevated\([^)]*attended: false/, "nothing ever asks for an unattended elevation");
assert.match(main, /"Clear-DnsClientCache"/, "the user-space DNS cache clear is on the recipe allowlist");
g();

assert.equal(groups, 9);
console.log(`needs-admin-matrix test passed (${groups} groups · ${flagged} flagged registry steps · 4 admin executor bindings · no Dnscache anywhere · exit guard · stderr denial = needs-admin · elevated routing · RunAs+EncodedCommand shape · honest UAC copy · main wiring).`);
