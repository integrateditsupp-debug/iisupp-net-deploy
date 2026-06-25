// Q-DIR slice 2 — live Microsoft Graph DirectoryProvider adapter. Verified against an INJECTED mock Graph
// (no live tenant touched here): client-credentials token + caching, correct read-only Graph requests,
// response→shape mapping, secret-never-leaked, gated writes, and end-to-end through directory.mjs read ops.
import assert from "node:assert/strict";
import { createGraphClient, getGraphConfig, graphReadOnlySmoke } from "../src/shared/entra-graph-client.mjs";
import { lookupUser, accountStatus, groupMembership, listDevices, resolveTarget } from "../src/shared/directory.mjs";

const ENV = { DIRECTORY_TENANT_ID: "tenant-abc", DIRECTORY_CLIENT_ID: "app-123", DIRECTORY_CLIENT_SECRET: "SUPER_SECRET_VALUE" };

// Mock Graph: records every request; routes token + read endpoints. Never the real network.
function mockGraph() {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/oauth2/v2.0/token")) {
      return resp(200, { access_token: "tok-XYZ", expires_in: 3600 });
    }
    if (/\/users\?\$filter=/.test(url)) {
      return resp(200, { value: [{ id: "U1", displayName: "Alice Alpha", manager: { id: "M1" } }] });
    }
    if (/\/users\/U1\?\$select=/.test(url)) {
      return resp(200, { id: "U1", displayName: "Alice Alpha", accountEnabled: true });
    }
    if (/\/users\/U1\/memberOf/.test(url)) {
      return resp(200, { value: [{ id: "G1", displayName: "Finance" }, { id: "G2", displayName: "All Staff" }] });
    }
    if (/\/users\/U1\/registeredDevices/.test(url)) {
      return resp(200, { value: [{ id: "D1", operatingSystem: "Windows", isCompliant: true }] });
    }
    return resp(404, {});
  };
  return { fetch, calls };
}
function resp(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
let n = 0; const g = () => { n++; };

// 1 — config: needs all three; never echoes the secret.
assert.equal(getGraphConfig({}).configured, false);
assert.equal(getGraphConfig(ENV).configured, true);
assert.ok(!JSON.stringify(getGraphConfig(ENV)).includes("SUPER_SECRET_VALUE"), "config must not leak the secret");
assert.equal(createGraphClient({}), null, "unconfigured → null client (stays on mock/dry-run)");
g();

// 2 — token: client-credentials to the right endpoint, .default scope, then CACHED across reads.
{
  const m = mockGraph();
  const c = createGraphClient(ENV, { fetch: m.fetch });
  await c.findUsers("alice");
  await c.getUser("U1");
  const tokenCalls = m.calls.filter((x) => x.url.includes("/oauth2/v2.0/token"));
  assert.equal(tokenCalls.length, 1, "token fetched once and cached across calls");
  assert.match(tokenCalls[0].url, /login\.microsoftonline\.com\/tenant-abc\/oauth2\/v2\.0\/token/, "tenant-scoped token endpoint");
  assert.match(tokenCalls[0].init.body, /grant_type=client_credentials/, "client-credentials grant");
  assert.match(tokenCalls[0].init.body, /scope=https%3A%2F%2Fgraph\.microsoft\.com%2F\.default/, "least-privilege .default scope");
  g();

  // 3 — read GETs carry the Bearer token, NOT the secret.
  const reads = m.calls.filter((x) => x.url.includes("graph.microsoft.com"));
  for (const r of reads) {
    assert.equal(r.init.headers.Authorization, "Bearer tok-XYZ", "read uses bearer token");
    assert.ok(!r.url.includes("SUPER_SECRET_VALUE") && !JSON.stringify(r.init.headers).includes("SUPER_SECRET_VALUE"), "secret never on a read request");
  }
  g();
}

// 4 — token REFRESH after expiry (injected clock).
{
  const m = mockGraph();
  let t = 1000;
  const c = createGraphClient(ENV, { fetch: m.fetch, now: () => t });
  await c.findUsers("a");
  t += 4000 * 1000; // jump past expiry
  await c.findUsers("a");
  assert.equal(m.calls.filter((x) => x.url.includes("/token")).length, 2, "token re-fetched after expiry");
  g();
}

// 5 — read ops map Graph → the directory.mjs shape.
{
  const m = mockGraph();
  const c = createGraphClient(ENV, { fetch: m.fetch });
  const users = await c.findUsers("alice");
  assert.deepEqual(users, [{ id: "U1", displayName: "Alice Alpha", managerId: "M1" }], "findUsers maps id/displayName/managerId");
  const fu = m.calls.find((x) => /\/users\?\$filter=/.test(x.url));
  assert.match(fu.url, /startswith\(displayName/, "filter by startswith(displayName)");
  assert.match(fu.url, /\$expand=manager/, "expands manager for managerId");
  assert.deepEqual(await c.getUser("U1"), { id: "U1", displayName: "Alice Alpha", accountEnabled: true, lockedOut: false }, "getUser shape");
  assert.deepEqual(await c.getMemberGroups("U1"), [{ id: "G1", displayName: "Finance" }, { id: "G2", displayName: "All Staff" }], "getMemberGroups shape");
  assert.deepEqual(await c.getDevices("U1"), [{ id: "D1", os: "Windows", compliant: true }], "getDevices shape");
  g();
}

// 6 — WRITES are gated (not silently no-op).
{
  const c = createGraphClient(ENV, { fetch: mockGraph().fetch });
  for (const op of ["setLocked", "setEnabled", "addGroupMember", "removeGroupMember", "resetPassword"]) {
    await assert.rejects(() => c[op]("U1", true), /directory_write_not_enabled/, `${op} is gated`);
  }
  g();
}

// 7 — END-TO-END through directory.mjs read ops with the LIVE adapter (mock fetch) → content-blind output.
{
  const c = createGraphClient(ENV, { fetch: mockGraph().fetch });
  const lu = await lookupUser("alice", { client: c });
  assert.ok(lu.ok && lu.matches.length === 1 && /^uid-/.test(lu.matches[0].ref), "lookup content-blind ref");
  assert.equal((await resolveTarget("alice", { client: c })).certain, true, "single match → certain");
  const st = await accountStatus("U1", { client: c });
  assert.ok(st.ok && st.enabled === true && st.locked === false && /^uid-/.test(st.id), "accountStatus");
  assert.equal((await groupMembership("U1", { client: c })).groups.length, 2, "groupMembership");
  assert.equal((await listDevices("U1", { client: c })).devices[0].os, "Windows", "listDevices");
  g();
}

// 8 — smoke: unconfigured FLAGS what's missing; configured + mock → ok.
{
  const off = await graphReadOnlySmoke({});
  assert.ok(!off.ok && off.configured === false && off.needs.includes("DIRECTORY_TENANT_ID"), "unconfigured smoke flags creds");
  const on = await graphReadOnlySmoke(ENV, { fetch: mockGraph().fetch, sampleQuery: "a" });
  assert.ok(on.ok && on.configured === true, "configured smoke ok against mock");
  g();
}

assert.equal(n, 8, "8 graph-adapter groups");
console.log(`entra-graph-client test passed (${n} groups · client-credentials token + cache + refresh · least-privilege .default · read-only Graph requests mapped to shape · secret never leaked · writes gated · end-to-end via directory.mjs content-blind · smoke flags unconfigured creds).`);
