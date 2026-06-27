// MODULE 2 — gated Entra (cloud) remediation. Locks: honest framing (no fake "unlocked"; cloud
// accounts aren't "locked"), target-certainty STOP (exact GUID/UPN or refuse), gating (no approval →
// no token, no call), not-authorized surfaced on 401/403 (never faked), and read-back verification.
import assert from "node:assert/strict";
import { remediateUser, isExactTarget, remediationLabel, ENTRA_REMEDIATIONS, getUser } from "../src/shared/entra-graph-client.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

const ENV = { DIRECTORY_TENANT_ID: "tid", DIRECTORY_CLIENT_ID: "cid", DIRECTORY_CLIENT_SECRET: "sec" };
const GUID = "11111111-1111-1111-1111-111111111111";
const UPN = "testuser@contoso.onmicrosoft.com";

function mkRes({ status = 200, ok, body = {} }) {
  return { ok: ok == null ? status >= 200 && status < 300 : ok, status, json: async () => body };
}
function fakeFetch(rules) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: (opts.method || "GET").toUpperCase(), body: opts.body });
    for (const r of rules) if (r.match(url, opts)) return mkRes(r.res);
    return mkRes({ status: 404, ok: false });
  };
  fn.calls = calls;
  return fn;
}
const tokenRule = { match: (u) => u.includes("/oauth2/v2.0/token"), res: { status: 200, body: { access_token: "tok" } } };

// ── 1 · isExactTarget: GUID + UPN accepted; vague names rejected ──
assert.equal(isExactTarget(GUID), true);
assert.equal(isExactTarget(UPN), true);
assert.equal(isExactTarget("bob"), false);
assert.equal(isExactTarget(""), false);
ok("target certainty: only an exact GUID/UPN qualifies");

// ── 2 · Honest label: revoke is framed as re-auth, explicitly NOT a fake unlock ──
{
  const label = remediationLabel("revokeSignInSessions");
  assert.match(label, /re-authentication/i);
  assert.match(label, /never .?locked.?/i, "explicitly says the account was never 'locked'");
  assert.doesNotMatch(label, /\bunlocked\b/i, "never claims a fake 'unlocked'");
  ok("honest framing: revoke labeled as re-auth, no fake 'unlocked'");
}

// ── 3 · Gated: no approval → needsApproval, no token/network ──
{
  const fetch = fakeFetch([tokenRule]);
  const r = await remediateUser({ action: "revokeSignInSessions", userId: GUID, approved: false }, { env: ENV, fetch });
  assert.equal(r.needsApproval, true);
  assert.equal(fetch.calls.length, 0, "no token acquired when unapproved");
  ok("gated: unapproved remediation acquires no token, makes no call");
}

// ── 4 · Target uncertain → STOP (no token, no write) even when approved ──
{
  const fetch = fakeFetch([tokenRule]);
  const r = await remediateUser({ action: "revokeSignInSessions", userId: "someone", approved: true }, { env: ENV, fetch });
  assert.equal(r.targetUncertain, true);
  assert.equal(fetch.calls.length, 0, "no network on an uncertain target");
  ok("target uncertain: STOP before any token or write");
}

// ── 5 · Not configured → notConfigured (no fake) ──
{
  const r = await remediateUser({ action: "revokeSignInSessions", userId: GUID, approved: true }, { env: {}, fetch: fakeFetch([tokenRule]) });
  assert.equal(r.notConfigured, true);
  ok("honest: missing directory creds flagged, not faked");
}

// ── 6 · Not authorized: 403 on the write → notAuthorized, never a fake success ──
{
  const fetch = fakeFetch([
    tokenRule,
    { match: (u, o) => u.includes("/revokeSignInSessions") && o.method === "POST", res: { status: 403, ok: false } }
  ]);
  const r = await remediateUser({ action: "revokeSignInSessions", userId: GUID, approved: true }, { env: ENV, fetch });
  assert.equal(r.ok, false);
  assert.equal(r.notAuthorized, true);
  assert.match(r.message, /admin consent/i, "explains the missing write scope/consent");
  ok("honest: 403 → 'Not authorized' (missing write scope/consent), never faked");
}

// ── 7 · Happy revoke: token → 204 → read-back GET → ok + verified ──
{
  const fetch = fakeFetch([
    tokenRule,
    { match: (u, o) => u.includes("/revokeSignInSessions") && o.method === "POST", res: { status: 204, ok: true } },
    { match: (u, o) => (o.method || "GET") === "GET" && u.includes("/users/"), res: { status: 200, body: { id: GUID, userPrincipalName: UPN, signInSessionsValidFromDateTime: "2026-06-27T00:00:00Z" } } }
  ]);
  const r = await remediateUser({ action: "revokeSignInSessions", userId: GUID, approved: true }, { env: ENV, fetch });
  assert.equal(r.ok, true);
  assert.equal(r.verified, true, "read-back GET confirmed the user");
  assert.equal(r.action, "revokeSignInSessions");
  assert.match(r.rollbackNote, /not reversible/i);
  ok("happy path: revoke executes, read-back-verifies, carries an honest rollback note");
}

// ── 8 · forcePasswordChange PATCHes passwordProfile + read-back confirms ──
{
  const fetch = fakeFetch([
    tokenRule,
    { match: (u, o) => o.method === "PATCH" && u.includes("/users/"), res: { status: 204, ok: true } },
    { match: (u, o) => (o.method || "GET") === "GET" && u.includes("/users/"), res: { status: 200, body: { id: GUID, userPrincipalName: UPN } } }
  ]);
  const r = await remediateUser({ action: "forcePasswordChange", userId: UPN, approved: true }, { env: ENV, fetch });
  assert.equal(r.ok, true);
  const patch = JSON.parse(fetch.calls.find((c) => c.method === "PATCH").body);
  assert.equal(patch.passwordProfile.forceChangePasswordNextSignIn, true, "sets forceChangePasswordNextSignIn");
  assert.match(r.rollbackNote, /reversible/i);
  ok("forcePasswordChange PATCHes passwordProfile + reversible rollback note");
}

// ── 9 · getUser is read-only and surfaces 403 as notAuthorized ──
{
  const fetch = fakeFetch([tokenRule, { match: (u, o) => (o.method || "GET") === "GET", res: { status: 403, ok: false } }]);
  const r = await getUser(GUID, ENV, { fetch });
  assert.equal(r.ok, false);
  assert.equal(r.notAuthorized, true);
  assert.deepEqual(ENTRA_REMEDIATIONS, ["revokeSignInSessions", "forcePasswordChange"]);
  ok("getUser read-back is read-only; 403 → notAuthorized");
}

assert.equal(tests, 9, "entra-remediation runs exactly 9 cases");
console.log(`Entra-remediation test passed (${tests}/9 · no fake 'unlocked' · target-certain STOP · gated · 403→not-authorized · read-back-verified).`);
