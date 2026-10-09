// RUN-CU / CU4 — the audit's safety fixes, each proven: (a) kill/blocked is line 1 of both executors; (b) the control
// plane is read at launch + 24h and the heartbeat reply carries {killed}; (c) restore points are REAL or honestly
// unavailable and yellow is gated on created===true; (f) policy.allowed / overlay / needsConfirm enforced + the
// keep-dry-run writer; (g) SENTINEL_ADMIN_TOKEN alias; (h) HMAC-keyed seal in its own file, missing seal = tampered,
// retention no-op fixed, monthly archive; (i) deep link → approval; (j) externalAiCalls real + device hash;
// (k) renderer reads state.platform and relabels (every control kept).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sealAuditKeyed, verifyAuditKeyed, sealAudit, verifyAudit } from "../src/shared/audit-integrity.mjs";
import { requireAdminToken, adminTokenMatch, ADMIN_TOKEN_ENV_NAMES } from "../src/shared/admin-auth.mjs";
import { pickUndoTarget, buildKillResult, parseControlPlaneKill } from "../src/shared/kill-switch.mjs";
import { isActionExecutable } from "../src/shared/recipe-runner.mjs";
import { normalizeHistory, buildChatRequest, HISTORY_MAX_TURNS } from "../src/shared/aria-brain-client.mjs";

let n = 0; const t = () => { n++; };
const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const main = rd("src", "main", "main.mjs");
const fnOf = (name) => { const m = main.match(new RegExp(`(?:async )?function ${name}\\b[\\s\\S]*?\\n\\}`)); assert.ok(m, `${name} found`); return m[0]; };

// (a) — kill/blocked check is the FIRST statement of runTier0Fix AND runSupervisedFix.
{
  for (const name of ["runTier0Fix", "runSupervisedFix"]) {
    const fn = fnOf(name);
    const lines = fn.split("\n").slice(1); // drop the signature line
    const firstStmt = lines.find((l) => l.trim() && !l.trim().startsWith("//"));
    assert.match(firstStmt, /if \(remediationKilled\(\) \|\| agentBlocked\(\)\)/, `${name}: the kill/blocked gate is LINE 1 of the body`);
    assert.ok(fn.indexOf("blockedRecipeResult(") > -1, `${name} returns the blocked result shape`);
  }
  const sup = fnOf("runSupervisedFix");
  assert.ok(sup.search(/remediationKilled\(\) \|\| agentBlocked\(\)/) < sup.indexOf("isBlockedPath("), "runSupervisedFix: kill gate precedes even R11");
  const tier0 = fnOf("runTier0Fix");
  assert.ok(tier0.indexOf("remediationKilled()") < tier0.indexOf("executeTier0("), "runTier0Fix: gate before the executor");
}
t();

// (b) — updateKnowledge at launch + in the 24h interval; sendHeartbeat parses {killed} from the reply.
{
  const launch = main.slice(main.indexOf("app.whenReady().then(() => {"), main.indexOf("app.on(\"activate\""));
  assert.match(launch, /updateKnowledge\(\)\.catch\(\(\) => undefined\);/, "updateKnowledge() at launch");
  assert.match(launch, /24 \* 60 \* 60 \* 1000[\s\S]{0,40}|setInterval\(\(\) => \{[^\n]*updateKnowledge\(\)\.catch[^\n]*24 \* 60 \* 60 \* 1000/, "…and on the 24h interval");
  assert.ok(/setInterval\(\(\) => \{ runUpdateCheck\("daily"\)[^\n]*updateKnowledge\(\)\.catch\(\(\) => undefined\); \}, 24 \* 60 \* 60 \* 1000\)/.test(main), "24h interval includes updateKnowledge");
  const hb = fnOf("sendHeartbeat");
  assert.match(hb, /parseControlPlaneKill\(body\)/, "heartbeat reply parsed for a kill directive");
  assert.match(hb, /if \(kill\.present\) applyControlPlaneKill\(kill\.killed, kill\.reason\)/);
  assert.deepEqual(parseControlPlaneKill({ ok: true, killed: true, reason: "fleet pause" }), { present: true, killed: true, reason: "fleet pause" });
}
t();

// (c) — real restore points: wrapper commands + verifyCreated through runPowerShell; yellow gated on created===true; honest copy.
{
  assert.match(main, /import \{ RESTORE_COMMANDS, sequenceOf, verifyCreated, isThrottled \} from "\.\/restore-point\.mjs"/, "restore-point.mjs is wired (was unwired)");
  const rp = fnOf("recordRestorePoint");
  assert.match(rp, /runPowerShell\(RESTORE_COMMANDS\.list/); assert.match(rp, /runPowerShell\(RESTORE_COMMANDS\.create/); assert.match(rp, /verifyCreated\(before, after\)/);
  assert.match(rp, /created = status === "created"/, "created is true ONLY when verified");
  assert.match(rp, /line: restoreCopy\(status, sequenceNumber\)/, "every record carries the honest status copy");
  assert.match(fnOf("restoreCopy"), /restore point unavailable on this platform\/account/i, "honest copy, never 'Restore point created' by default");
  assert.doesNotMatch(rp, /logEvent\("RESTORE PT", `Restore point created before/, "the old unconditional 'created' log line is gone");
  const rr = fnOf("runRecipe");
  assert.match(rr, /const restorePointTaken = Boolean\(restorePoint && restorePoint\.created === true\)/, "yellow execution gated on a verified point");
  assert.match(rr, /restorePoint = await recordRestorePoint\(/, "restore point awaited (real work) before actions");
  assert.match(rr, /Held in preview: a restore point is unavailable on this platform\/account/, "yellow held without a point says so");
  // the pure gate: a record without created===true never lets a yellow run
  const ya = { shell: "powershell", command: "Stop-Process -Name OUTLOOK" };
  assert.equal(isActionExecutable({ recipeId: "outlook-ost-repair-v1", action: ya, allowSystemFixes: true, dryRun: false, confirmed: true, restorePointTaken: false }), false);
  // kill-switch undo picks only verified points (legacy records without the field keep working)
  assert.equal(pickUndoTarget([{ id: "fake", created: false }, { id: "real", created: true }]).id, "real");
  assert.equal(pickUndoTarget([{ id: "legacy" }]).id, "legacy");
  assert.equal(pickUndoTarget([{ id: "fake", created: false }]), null);
  assert.equal(buildKillResult({ children: [], restorePoints: [{ id: "fake", created: false }] }).undone, false, "no verified point → nothing is claimed undone");
  const rb = fnOf("rollbackRestorePoint");
  assert.match(rb, /nothing to roll back to/i, "rollback of a non-verified record says so");
  assert.match(rd("src", "renderer", "renderer.js"), /Restore point created/, "the restore list copy still exists for verified points");
}
t();

// (f) — policy.allowed, overlay recipes_disabled, supervisor needsConfirm and business hours enforced; keep-dry-run has a writer.
{
  const sup = fnOf("runSupervisedFix");
  assert.match(sup, /if \(!policy\.allowed\) \{/, "policy.allowed enforced");
  assert.match(sup, /isRecipeAllowedByPolicy\(overlay, recipeId\)/, "customer overlay enforced");
  assert.match(sup, /const needsConfirm = Boolean\(verdict\.supervisorEvidence && verdict\.supervisorEvidence\.needsConfirm\)/, "supervisor needsConfirm read");
  assert.match(sup, /policy\.requiresCountdown \|\| needsConfirm/, "…and it forces the countdown");
  assert.match(sup, /businessHoursOpen\(overlay, new Date\(\)\)/, "business_hours overlay consulted");
  assert.match(sup, /outside-business-hours/, "outside hours → approval, never a silent run");
  const rr = fnOf("runRecipe");
  assert.match(rr, /isRecipeAllowedByPolicy\(store\.get\("policyOverlay"\) \|\| null, recipeId\)/, "overlay enforced on the direct path too");
  assert.match(main, /ipcMain\.handle\("sentinel:set-keep-dry-run"/, "keep-dry-run IPC writer exists");
  assert.match(main, /store\.set\("keepSystemFixesDryRun", Boolean\(on\)\)/, "…and writes the flag the policy reads");
  assert.match(main, /dryRunCheckbox: store\.get\("keepSystemFixesDryRun"\)/, "policy still reads the same key (unchanged)");
  assert.match(rd("src", "main", "preload.cjs"), /setKeepDryRun:/); assert.match(rd("src", "renderer", "index.html"), /id="keepDryRunToggle"/);
}
t();

// (g) — SENTINEL_ADMIN_TOKEN is an alias of ARIA_ADMIN_TOKEN (either works; both set → either matches; constant-time).
{
  assert.deepEqual([...ADMIN_TOKEN_ENV_NAMES], ["ARIA_ADMIN_TOKEN", "SENTINEL_ADMIN_TOKEN"]);
  assert.equal(requireAdminToken({ "x-admin-token": "s3cret-long" }, { SENTINEL_ADMIN_TOKEN: "s3cret-long" }).ok, true, "SENTINEL_ADMIN_TOKEN alone works");
  assert.equal(requireAdminToken({ "x-admin-token": "s3cret-long" }, { ARIA_ADMIN_TOKEN: "s3cret-long" }).ok, true, "ARIA_ADMIN_TOKEN alone still works");
  const both = requireAdminToken({ "x-admin-token": "bbb-token-x" }, { ARIA_ADMIN_TOKEN: "aaa-token-x", SENTINEL_ADMIN_TOKEN: "bbb-token-x" });
  assert.deepEqual(both, { ok: true, status: 200, reason: "ok" }, "return shape unchanged (admin-publish pins it)");
  assert.equal(adminTokenMatch({ "x-admin-token": "bbb-token-x" }, { ARIA_ADMIN_TOKEN: "aaa-token-x", SENTINEL_ADMIN_TOKEN: "bbb-token-x" }), "SENTINEL_ADMIN_TOKEN");
  assert.equal(adminTokenMatch({ "x-admin-token": "nope-token-x" }, { ARIA_ADMIN_TOKEN: "aaa-token-x" }), null);
  assert.equal(requireAdminToken({ "x-admin-token": "wrong-token" }, { ARIA_ADMIN_TOKEN: "aaa-token-x", SENTINEL_ADMIN_TOKEN: "bbb-token-x" }).reason, "bad-admin-token");
  assert.equal(requireAdminToken({ "x-admin-token": "x" }, {}).reason, "admin-token-not-configured");
  assert.equal(requireAdminToken({}, { SENTINEL_ADMIN_TOKEN: "x" }).reason, "missing-admin-token");
}
t();

// (h) — keyed seal: HMAC under the app key, separate file, missing seal with a non-empty log = tampered; legacy seal still verifies.
{
  const log = [{ ts: "2026-10-08T12:00:00Z", tag: "RUN", text: "a" }, { ts: "2026-10-08T12:01:00Z", tag: "DONE", text: "b" }];
  const s1 = sealAuditKeyed(log, "key-A"), s2 = sealAuditKeyed(log, "key-B");
  assert.equal(s1.v, "audit-seal-v2"); assert.equal(s1.count, 2); assert.notEqual(s1.seal, s2.seal, "the seal depends on the key (HMAC, not a public chain)");
  assert.notEqual(s1.seal, sealAudit(log).seal, "keyed ≠ unkeyed");
  assert.equal(verifyAuditKeyed(log, s1, "key-A").ok, true);
  assert.equal(verifyAuditKeyed(log, s1, "key-B").reason, "key-mismatch", "a seal forged under another key is rejected");
  assert.equal(verifyAuditKeyed([log[0], { ...log[1], text: "edited" }], s1, "key-A").reason, "entry-modified");
  assert.equal(verifyAuditKeyed([log[0]], s1, "key-A").reason, "row-count-changed");
  const missing = verifyAuditKeyed(log, null, "key-A");
  assert.equal(missing.ok, false); assert.equal(missing.reason, "seal-missing"); assert.equal(missing.alertAdmin, true, "deleting the seal file is a tamper finding, not a re-baseline");
  assert.equal(verifyAuditKeyed([], null, "key-A").ok, true, "an empty log with no seal is a fresh install");
  assert.equal(verifyAudit(log, sealAudit(log)).ok, true, "legacy v1 seal still verifies (kept)");
  assert.match(main, /const AUDIT_SEAL_FILE = \(\) => path\.join\(app\.getPath\("userData"\), "audit-seal\.json"\)/, "keyed seal lives in its own file");
  assert.match(main, /sealAuditKeyed\(log, appHmacKey\(\)\)/, "sealed under appHmacKey()");
  const vai = fnOf("verifyAuditIntegrity");
  assert.match(vai, /verifyAuditKeyed\(log, keyed, appHmacKey\(\)\)/, "the keyed seal is authoritative");
  assert.match(vai, /verifyAuditKeyed\(log, null, appHmacKey\(\)\)/, "non-empty log + no seal at all → seal-missing (banner)");
  assert.match(vai, /legacy-seal-migrated/, "a verified legacy seal migrates once instead of flagging every upgrade");
  assert.match(main, /store\.set\("auditSeal", sealAudit\(/, "the legacy seal is still written (Rule 15)");
  // retention: the no-op filter is gone; cold rows rotate to the monthly archive; overflow past 250 is archived too
  const rc = fnOf("runRetentionCleanup");
  assert.doesNotMatch(rc, /\|\| true\)/, "the `>= cutoff || true` no-op is fixed");
  assert.match(rc, /archiveAuditRows\(cold\)/, "rows past the hot window rotate to userData/audit/YYYY-MM.jsonl");
  assert.match(main, /AUDIT_ARCHIVE_DIR = \(\) => path\.join\(app\.getPath\("userData"\), "audit"\)/);
  assert.match(main, /\$\{month\.replace\(\/\[\^0-9-\]\/g, ""\)\}\.jsonl/, "monthly file name");
  const le = fnOf("logEvent");
  assert.match(le, /if \(current\.length > 250\) \{ try \{ archiveAuditRows\(current\.slice\(250\)\)/, "the 250-row cap archives instead of dropping");
}
t();

// (i) — a deep link creates an approval instead of executing instantly.
{
  const h = fnOf("handleSentinelDeepLink");
  assert.match(h, /runSupervisedFix\(\{ recipeId: parsed\.recipeId, mode: "confirmed", source: "deep-link"/, "deep link is tagged source:deep-link");
  const sup = fnOf("runSupervisedFix");
  assert.match(sup, /else if \(source === "deep-link"\) \{[\s\S]*?action: "request-approval", reason: "deep-link-requires-approval"/, "…which always becomes an approval request");
  assert.match(h, /queued for your approval/, "the audit line says so");
}
t();

// (j) — externalAiCalls reflects reality; X-Sentinel-Device is a hash, not the hostname; history + voice fields travel.
{
  assert.doesNotMatch(main, /externalAiCalls: false,/, "the literal externalAiCalls:false is gone from getState/buildReports");
  assert.match(main, /externalAiCalls: externalAiCallsNow\(\)/);
  assert.match(main, /lastChatProvider = \{ provider: "aria-brain", action: brain\.action \|\| null, anthropic: brain\.action !== "kb-match"/, "a KB hit is not an external AI call; a brain answer is");
  const chatFn = fnOf("chat");
  assert.match(chatFn, /deviceId: deviceIdHash\(\)/, "chat() sends the device hash");
  assert.doesNotMatch(chatFn, /os\.hostname\(\)/, "the raw hostname no longer travels as X-Sentinel-Device");
  assert.match(fnOf("deviceIdHash"), /createHash\("sha256"\)\.update\(`\$\{os\.hostname\(\)\}::aria-sentinel-device`\)/, "a stable salted sha256 of the hostname");
  const req = buildChatRequest("and the printer?", { deviceId: "abc123", messages: [{ role: "user", content: "wifi drops" }, { role: "assistant", content: "Toggle Wi-Fi… see C:\\Users\\bob\\x" }], voice: true });
  const body = JSON.parse(req.body);
  assert.equal(body.messages.length, 3); assert.equal(body.messages[0].role, "user"); assert.equal(body.messages[2].content, "and the printer?");
  assert.doesNotMatch(body.messages[1].content, /C:\\Users/, "history is R11-scrubbed");
  assert.equal(body.voice, true); assert.equal(req.headers["X-Sentinel-Device"], "abc123");
  assert.equal(normalizeHistory(new Array(30).fill({ role: "user", content: "x" })).length, HISTORY_MAX_TURNS, "history capped");
  assert.equal(normalizeHistory([{ role: "system", content: "x" }, { role: "user", content: "" }]).length, 0, "only user/assistant turns with content");
  assert.ok(!("voice" in JSON.parse(buildChatRequest("hi", {}).body)), "non-voice requests are byte-compatible (no voice flag)");
}
t();

// (k) — renderer reads state.platform / platformCapabilities and relabels where no fix engine exists; every control stays.
{
  const rjs = rd("src", "renderer", "renderer.js");
  assert.match(rjs, /function renderPlatformHonesty\(next\)/);
  assert.match(rjs, /next\.platformCapabilities/, "reads the main-provided capabilities (from state.platform)");
  assert.match(rjs, /Guide me \(detect-only here\)/, "relabel copy");
  assert.match(rjs, /data-resolve-fix=/, "the Resolve control is kept (relabelled, never removed)");
  assert.match(rjs, /platformModeNote/, "Mode panel says what applies on this platform");
  assert.match(main, /platformCapabilities: platformCapabilities\(process\.platform\)/, "getState carries the honest capabilities");
  assert.match(main, /platform: process\.platform,/, "state.platform still exposed");
  const isv = main.slice(main.indexOf('ipcMain.handle("sentinel:is-vetted"'), main.indexOf('ipcMain.handle("sentinel:is-vetted"') + 600);
  assert.match(isv, /process\.platform === "darwin"[\s\S]*?isDarwinTier0\(id\)/, "is-vetted is platform-aware");
  assert.match(isv, /no fix engine on this platform/, "…and says guided-only elsewhere");
}
t();

assert.equal(n, 9, "9 safety-fix groups (a b c f g h i j k)");
console.log(`safety-fixes-cu4 test passed (${n} groups · kill line 1 · control plane at launch/24h + heartbeat killed · real restore points gate yellow · policy/overlay/needsConfirm/hours enforced + keep-dry-run · admin token alias · HMAC seal in own file, seal-missing = tampered, retention real · deep link → approval · externalAiCalls real + device hash · platform relabels).`);
