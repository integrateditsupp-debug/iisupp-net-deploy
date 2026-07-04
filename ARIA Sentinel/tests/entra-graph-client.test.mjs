// Q-DIR slice 2 - Microsoft Graph adapter is read-only by default; writes are approval-gated and verified.
import assert from "node:assert/strict";
import {
  hasEntraCredentials,
  getDirectoryConfig,
  acquireToken,
  readOnlyProbe,
  isExactTarget,
  remediateUser
} from "../src/shared/entra-graph-client.mjs";

let n = 0;
const t = () => { n++; };
const env = { DIRECTORY_TENANT_ID: "tenant", DIRECTORY_CLIENT_ID: "client", DIRECTORY_CLIENT_SECRET: "secret" };

assert.equal(hasEntraCredentials({}), false);
assert.equal(hasEntraCredentials(env), true);
assert.deepEqual(getDirectoryConfig(env), { configured: true, tenantId: "tenant", clientId: "client" });
assert.ok(!JSON.stringify(getDirectoryConfig(env)).includes("secret"), "config snapshot never returns secret");
t();

const tokenCalls = [];
const token = await acquireToken(env, { fetch: async (url, opts = {}) => {
  tokenCalls.push({ url: String(url), method: opts.method, body: String(opts.body || "") });
  return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
} });
assert.equal(token.ok, true);
assert.equal(tokenCalls[0].method, "POST");
assert.match(tokenCalls[0].body, /client_secret=secret/);
t();

const probeCalls = [];
const probe = await readOnlyProbe(env, { fetch: async (url, opts = {}) => {
  probeCalls.push({ url: String(url), method: opts.method || "GET" });
  if (String(url).includes("/token")) return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
  return { ok: true, status: 200, json: async () => ({ value: [{ id: "u1" }] }) };
} });
assert.equal(probe.ok, true);
assert.equal(probeCalls[1].method, "GET");
assert.ok(!probeCalls.some((c) => /graph\.microsoft\.com/.test(c.url) && c.method !== "GET"), "readOnlyProbe never writes to Graph");
t();

assert.equal(isExactTarget("user@example.com"), true);
assert.equal(isExactTarget("11111111-1111-1111-1111-111111111111"), true);
assert.equal(isExactTarget("first name"), false);
let r = await remediateUser({ action: "revokeSignInSessions", userId: "user@example.com" }, { env });
assert.equal(r.needsApproval, true, "write remediation needs explicit approval");
r = await remediateUser({ action: "revokeSignInSessions", userId: "first name", approved: true }, { env });
assert.equal(r.targetUncertain, true, "uncertain target is refused");
t();

const writeCalls = [];
r = await remediateUser(
  { action: "revokeSignInSessions", userId: "user@example.com", approved: true },
  { env, fetch: async (url, opts = {}) => {
    writeCalls.push({ url: String(url), method: opts.method || "GET" });
    if (String(url).includes("/token")) return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
    if (String(url).includes("revokeSignInSessions")) return { ok: true, status: 204, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ id: "u1", userPrincipalName: "user@example.com" }) };
  } }
);
assert.equal(r.ok, true);
assert.equal(r.verified, true);
assert.ok(writeCalls.some((c) => c.method === "POST" && /revokeSignInSessions/.test(c.url)), "approved remediation writes only the chosen endpoint");
assert.ok(writeCalls.some((c) => c.method === "GET" && /\$select=/.test(c.url)), "success is read-back verified");
t();

assert.equal(n, 5, "5 entra graph groups");
console.log(`Entra Graph client test passed (${n} groups - config, token, GET-only probe, gates, verified remediation).`);
