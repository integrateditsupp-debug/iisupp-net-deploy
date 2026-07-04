// Q-DIR - directory provider cannot-mess-up protocol: honest status, read-only probe, no writes.
import assert from "node:assert/strict";
import { getStatus, testConnection } from "../src/shared/directory.mjs";

let n = 0;
const t = () => { n++; };

assert.deepEqual(getStatus({}), { status: "not_configured", detail: "Tenant / client credentials not set" });
assert.equal(getStatus({ DIRECTORY_TENANT_ID: "t", DIRECTORY_CLIENT_ID: "c", DIRECTORY_CLIENT_SECRET: "s" }).status, "not_configured", "credentials alone never means connected");
t();

assert.deepEqual(await testConnection({}), { ok: false, message: "Not configured" });
t();

const calls = [];
const fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || "GET", body: opts.body || "" });
  if (String(url).includes("/oauth2/v2.0/token")) return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
  return { ok: true, status: 200, json: async () => ({ value: [{ id: "u1" }] }) };
};
const env = { DIRECTORY_TENANT_ID: "tenant", DIRECTORY_CLIENT_ID: "client", DIRECTORY_CLIENT_SECRET: "secret" };
const ok = await testConnection(env, { fetch });
assert.equal(ok.ok, true);
assert.equal(calls.length, 2);
assert.equal(calls[0].method, "POST", "token request is the only POST");
assert.equal(calls[1].method, "GET", "Graph directory check is GET-only");
assert.match(calls[1].url, /\/users\?\$top=1/);
assert.ok(!calls.some((c) => /graph\.microsoft\.com/.test(c.url) && c.method !== "GET"), "no write verb hits Graph");
t();

const failed = await testConnection(env, { fetch: async () => { throw new Error("network"); } });
assert.equal(failed.ok, false);
assert.equal(typeof failed.message, "string");
t();

assert.equal(n, 4, "4 directory groups");
console.log(`Directory test passed (${n} groups - honest status, no-creds, GET-only probe, failure-safe).`);
