// Q-DIR / Q-DIR+ (R-ZERO R3) — identity-tier HARD GATE. Every governed identity action is mock/test-tenant
// only and must obey the cannot-mess-up protocol. Includes the REQUIRED failure-injection cases: network
// drop mid-write, read-back mismatch -> auto-rollback, wrong/ambiguous target, never-autonomous,
// admin-approval, IDV verified/unverified, manager reports-to pass/fail, idempotent replay,
// no-plaintext-password, biometric-never-reaches-brain, per-connector toggle, least-privilege scope.
import assert from "node:assert/strict";
import {
  getDirectoryConfig, connectorEnabled, lookupUser, resolveTarget, accountStatus, groupMembership,
  listDevices, idvResult, IDV_FAIL_MESSAGE, performIdentityAction, auditEntry, WRITE_SCOPE_BY_ACTION,
} from "../src/shared/directory.mjs";

let n = 0; const group = () => { n++; };

// Mock Graph "tenant". Optional fail hooks inject network/permission/token failures per method.
function mockClient(opts = {}) {
  const users = new Map((opts.users || []).map((u) => [u.id, { lockedOut: false, accountEnabled: true, groups: [], ...u }]));
  const fail = opts.fail || {};
  const trip = (name) => { if (fail[name]) throw new Error(fail[name]); };
  return {
    state: users,
    async findUsers(q) { trip("findUsers"); return [...users.values()].filter((u) => (u.displayName || "").toLowerCase().includes(q.toLowerCase()) || u.id === q); },
    async getUser(id) { trip("getUser"); const u = users.get(id); return u ? { ...u } : null; },
    async getMemberGroups(id) { trip("getMemberGroups"); const u = users.get(id); return (u ? u.groups : []).map((g) => ({ id: g, displayName: g })); },
    async getDevices(id) { trip("getDevices"); return (users.get(id)?.devices) || []; },
    async setLocked(id, v) { trip("setLocked"); users.get(id).lockedOut = v; return { lockedOut: v }; },
    async setEnabled(id, v) { trip("setEnabled"); users.get(id).accountEnabled = v; return { accountEnabled: v }; },
    async addGroupMember(g, id) { trip("addGroupMember"); const u = users.get(id); if (!u.groups.includes(g)) u.groups.push(g); return { ok: true }; },
    async removeGroupMember(g, id) { trip("removeGroupMember"); const u = users.get(id); u.groups = u.groups.filter((x) => x !== g); return { ok: true }; },
    async resetPassword(id, o) { trip("resetPassword"); return { forceChangeAtNextLogon: o.forceChangeAtNextLogon, delivery: o.delivery }; },
  };
}
const admin = { mode: "confirmed", adminApproved: true, adminRole: true };
const baseUsers = [{ id: "U1", displayName: "Alice Alpha", managerId: "M1" }, { id: "M1", displayName: "Mike Manager" }];

// 1 — Config / editions / connectors.
assert.equal(getDirectoryConfig({}).configured, false, "no creds → not configured");
assert.equal(getDirectoryConfig({}).edition, "standalone");
const intgEnv = { DIRECTORY_TENANT_ID: "t", DIRECTORY_CLIENT_ID: "c", DIRECTORY_CLIENT_SECRET: "s" };
assert.equal(getDirectoryConfig(intgEnv).edition, "integrated");
assert.equal(connectorEnabled("rsa_securid", {}), false, "connectors off by default");
assert.equal(connectorEnabled("rsa_securid", { DIRECTORY_CONNECTOR_RSA_SECURID: "1" }), true, "connector toggles on");
group();

// 2 — READ-ONLY ops are content-blind (opaque refs, never raw UPN/email).
const lu = await lookupUser("alice", { client: mockClient({ users: baseUsers }) });
assert.ok(lu.ok && lu.matches.length === 1 && /^uid-/.test(lu.matches[0].ref), "lookup returns opaque ref");
const st = await accountStatus("U1", { client: mockClient({ users: baseUsers }) });
assert.ok(st.ok && /^uid-/.test(st.id) && st.enabled === true, "status content-blind");
assert.ok((await groupMembership("U1", { client: mockClient({ users: baseUsers }) })).ok);
assert.ok((await listDevices("U1", { client: mockClient({ users: baseUsers }) })).ok);
group();

// 3 — TARGET CERTAINTY: ambiguous (>1) and no-match both refuse; exactly-one is certain.
const dupe = mockClient({ users: [{ id: "A", displayName: "Sam Smith" }, { id: "B", displayName: "Sam Smith II" }] });
assert.equal((await resolveTarget("Sam Smith", { client: dupe })).certain, false, "ambiguous → not certain");
assert.equal((await resolveTarget("nobody", { client: mockClient({ users: baseUsers }) })).certain, false, "no match → not certain");
assert.equal((await resolveTarget("Alice Alpha", { client: mockClient({ users: baseUsers }) })).certain, true, "single → certain");
group();

// 4 — NEVER AUTONOMOUS + admin approval required.
let c = mockClient({ users: baseUsers });
let r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: { mode: "autonomous", adminApproved: true, adminRole: true }, requestedBy: { id: "M1" }, idv: { provider: "rsa_securid", verified: true } });
assert.ok(r.refused && r.reason === "identity_writes_never_autonomous", "autonomous identity write refused");
r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: { mode: "confirmed", adminApproved: false, adminRole: true }, requestedBy: { id: "M1" }, idv: { provider: "rsa_securid", verified: true } });
assert.ok(r.refused && r.reason === "admin_approval_required", "no admin approval → refused");
assert.equal(c.state.get("U1").lockedOut, false, "no write happened on refusal");
group();

// 5 — Ambiguous target NEVER writes.
r = await performIdentityAction("disable", { client: dupe, targetQuery: "Sam Smith", approval: admin, requestedBy: { id: "M1" } });
assert.ok(r.refused && /uncertain_target/.test(r.reason), "ambiguous target refused, no write");
group();

// 6 — IDV gate: end-user self-request unverified → refuse + escalate + the exact user message.
c = mockClient({ users: baseUsers.map((u) => ({ ...u, lockedOut: u.id === "U1" })) });
r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "U1" }, idv: { provider: "rsa_securid", verified: false } });
assert.ok(r.refused && r.escalate && r.userMessage === IDV_FAIL_MESSAGE, "self unverified → refuse+escalate+message");
assert.equal(c.state.get("U1").lockedOut, true, "still locked (no unlock on unverified)");
// verified self-request → proceeds + read-back verified.
r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "U1" }, idv: { provider: "rsa_securid", verified: true } });
assert.ok(r.ok && !r.refused, "verified self → unlock applied");
assert.equal(c.state.get("U1").lockedOut, false, "read-back: now unlocked");
group();

// 7 — Manager-delegated: reports-to FAIL refuses; PASS (+IDV) proceeds.
c = mockClient({ users: baseUsers.map((u) => ({ ...u, lockedOut: u.id === "U1" })) });
r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "X9" }, idv: { provider: "pingone_verify", verified: true } });
assert.ok(r.refused && r.reason === "not_in_reporting_line" && r.escalate, "wrong manager → refuse+escalate");
r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "M1" }, idv: { provider: "pingone_verify", verified: true } });
assert.ok(r.ok, "correct manager + IDV → applied");
group();

// 8 — NO PLAINTEXT PASSWORD: reset issues temp + force-change, never a reusable plaintext password.
c = mockClient({ users: baseUsers });
r = await performIdentityAction("reset_password", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "M1" }, idv: { provider: "rsa_securid", verified: true } });
assert.ok(r.ok && r.result.forceChangeAtNextLogon === true && r.result.delivery === "secure_link", "reset = temp + force-change + secure delivery");
assert.ok(!("plaintextPassword" in r.result) || r.result.plaintextPassword === undefined, "no plaintext password in result");
assert.ok(!JSON.stringify(r).toLowerCase().includes("password=") && !/plaintext.*:\s*"/i.test(JSON.stringify(r)), "no reusable password anywhere in the result");
group();

// 9 — BIOMETRIC never reaches ARIA: raw selfie/id/template → refused by idvResult.
assert.equal(idvResult({ provider: "builtin_idv", verified: true, rawSelfie: "<bytes>" }).verified, false, "raw selfie rejected");
assert.equal(idvResult({ provider: "builtin_idv", verified: true, biometricTemplate: "x" }).reason, "raw_biometric_must_not_reach_aria");
assert.equal(idvResult({ provider: "builtin_idv", verified: true }).verified, true, "pass/fail only → ok");
group();

// 10 — IDEMPOTENT replay: same requestId never double-applies.
c = mockClient({ users: [{ id: "U1", displayName: "Alice Alpha", managerId: "M1", groups: [] }, { id: "M1", displayName: "Mike Manager" }] });
const seen = new Set();
const addOpts = { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "M1" }, group: "G-Finance", requestId: "req-1", seen };
r = await performIdentityAction("add_group", addOpts);
assert.ok(r.ok && c.state.get("U1").groups.filter((g) => g === "G-Finance").length === 1, "group added once");
r = await performIdentityAction("add_group", addOpts);
assert.ok(r.idempotentReplay === true, "replay flagged idempotent");
assert.equal(c.state.get("U1").groups.filter((g) => g === "G-Finance").length, 1, "no double-apply on replay");
group();

// 11 — NETWORK DROP mid-write (execute throws) → no partial success, surfaced as execute error.
c = mockClient({ users: baseUsers.map((u) => ({ ...u, lockedOut: u.id === "U1" })), fail: { setLocked: "ETIMEDOUT" } });
r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "M1" }, idv: { provider: "rsa_securid", verified: true } });
assert.ok(!r.ok && r.error === "execute_failed", "network drop → execute_failed");
assert.equal(c.state.get("U1").lockedOut, true, "no partial state change after a mid-write drop");
group();

// 12 — READ-BACK MISMATCH → AUTO-ROLLBACK. (disable "succeeds" then re-enables under us.)
c = mockClient({ users: baseUsers });
const orig = c.setEnabled.bind(c);
c.setEnabled = async (id, v) => { await orig(id, v); if (v === false) c.state.get(id).accountEnabled = true; return { accountEnabled: v }; }; // tamper: flips back
r = await performIdentityAction("disable", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "M1" } });
assert.ok(!r.ok && r.mismatch && /read_back_mismatch/.test(r.reason), "mismatch detected");
assert.equal(r.rolledBack, true, "auto-rollback fired");
group();

// 13 — PERMISSION-DENIED / TOKEN-EXPIRY at execute → surfaced as execute_failed, no state change.
for (const f of ["AADSTS50076_permission_denied", "InvalidAuthenticationToken"]) {
  c = mockClient({ users: baseUsers.map((u) => ({ ...u, lockedOut: u.id === "U1" })), fail: { setLocked: f } });
  r = await performIdentityAction("unlock", { client: c, targetQuery: "Alice Alpha", approval: admin, requestedBy: { id: "M1" }, idv: { provider: "rsa_securid", verified: true } });
  assert.ok(!r.ok && r.error === "execute_failed", `${f} → execute_failed`);
}
group();

// 14 — LEAST-PRIVILEGE: each action declares the minimum write scope (not standing god-mode).
assert.deepEqual(WRITE_SCOPE_BY_ACTION.unlock, ["User.ReadWrite.All"]);
assert.deepEqual(WRITE_SCOPE_BY_ACTION.add_group, ["GroupMember.ReadWrite.All"]);
assert.ok(Object.keys(WRITE_SCOPE_BY_ACTION).length === 5, "all 5 actions scoped");
group();

// 15 — AUDIT hash-chain is tamper-evident (changing any field breaks the chain hash).
const a1 = auditEntry(null, "unlock", { actor: "M1", target: "U1", requestId: "r", result: "applied", ts: "T1" });
const a2 = auditEntry(a1.hash, "disable", { actor: "M1", target: "U1", requestId: "r2", result: "applied", ts: "T2" });
assert.equal(a2.prevHash, a1.hash, "chain links");
const forged = auditEntry(a1.hash, "disable", { actor: "M1", target: "U2", requestId: "r2", result: "applied", ts: "T2" });
assert.notEqual(forged.hash, a2.hash, "any field change yields a different hash");
group();

assert.equal(n, 15, "15 identity-tier groups");
console.log(`directory test passed (${n} groups · read-only content-blind · target-certainty · never-autonomous · admin-approval · IDV verified/unverified · manager reports-to · no-plaintext-pw · biometric-never-reaches-brain · idempotent · network-drop · read-back mismatch->auto-rollback · permission/token failures · least-privilege · tamper-evident audit).`);
