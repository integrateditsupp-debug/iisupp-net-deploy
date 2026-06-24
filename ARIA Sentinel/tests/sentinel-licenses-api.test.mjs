// RUN 24 A3 — admin licenses registry API logic: auth, filtering, revoke, key-hash lookup, CSV export.
import assert from "node:assert/strict";
import {
  isAdminAuthorized, filterRecords, revokeRecord, findRevokedByKeyHash, recordsToCsv, maskKey
} from "../src/shared/sentinel-license-funnel.mjs";
import { keyHash } from "../src/shared/license-features.mjs";

const TOKEN = "admin-token-secret";
let n = 0; const t = () => { n++; };

// 1 — admin auth: only a correct Bearer token passes; everything else fails (constant-time).
assert.equal(isAdminAuthorized(`Bearer ${TOKEN}`, TOKEN), true);
assert.equal(isAdminAuthorized("Bearer wrong", TOKEN), false, "wrong token");
assert.equal(isAdminAuthorized(`Bearer ${TOKEN}x`, TOKEN), false, "length mismatch");
assert.equal(isAdminAuthorized(TOKEN, TOKEN), false, "missing Bearer prefix");
assert.equal(isAdminAuthorized("", TOKEN), false, "no header");
assert.equal(isAdminAuthorized(`Bearer ${TOKEN}`, ""), false, "no server token → deny");
t();

// 2 — filter + sort newest-first.
const recs = [
  { email: "jane@acme.com", name: "Jane", tier: "pro", key: "k1", subscription_id: "s1", issued_at: "2026-06-20T00:00:00Z", status: "active" },
  { email: "bob@beta.io", name: "Bob", tier: "personal", key: "k2", subscription_id: "s2", issued_at: "2026-06-22T00:00:00Z", status: "active" },
  { email: "carol@acme.com", name: "Carol", tier: "smb", key: "k3", subscription_id: "s3", issued_at: "2026-06-21T00:00:00Z", status: "revoked" }
];
assert.deepEqual(filterRecords(recs, "").map((r) => r.subscription_id), ["s2", "s3", "s1"], "empty q → all, newest first");
assert.deepEqual(filterRecords(recs, "acme").map((r) => r.subscription_id), ["s3", "s1"], "filter by email domain");
assert.deepEqual(filterRecords(recs, "BOB").map((r) => r.subscription_id), ["s2"], "case-insensitive name match");
t();

// 3 — revoke is an immutable flip with a timestamp.
const rev = revokeRecord(recs[0], "2026-06-22T12:00:00Z");
assert.equal(rev.status, "revoked");
assert.equal(rev.revoked_at, "2026-06-22T12:00:00Z");
assert.equal(recs[0].status, "active", "original record unchanged");
t();

// 4 — key-hash revocation lookup returns only {found, revoked} (never a key/record field).
const active = { key: "alpha", status: "active" };
const revoked = { key: "bravo", status: "revoked" };
const data = [active, revoked];
assert.deepEqual(findRevokedByKeyHash(data, keyHash("alpha"), keyHash), { found: true, revoked: false });
assert.deepEqual(findRevokedByKeyHash(data, keyHash("bravo"), keyHash), { found: true, revoked: true });
assert.deepEqual(findRevokedByKeyHash(data, keyHash("nope"), keyHash), { found: false, revoked: false });
assert.deepEqual(Object.keys(findRevokedByKeyHash(data, keyHash("alpha"), keyHash)).sort(), ["found", "revoked"], "shape leaks nothing else");
t();

// 5 — CSV export masks the key column (raw key never enters a spreadsheet).
const csv = recordsToCsv(recs);
assert.match(csv.split("\n")[0], /^email,name,tier,key,subscription_id,issued_at,status$/, "header row");
assert.ok(csv.includes(maskKey("k1")) || csv.includes("…"), "key column is masked");
assert.ok(!csv.split("\n").slice(1).some((line) => /,"k1",|,"k2",|,"k3",/.test(line)), "raw key never appears in a CSV cell");
t();

// 6 — CSV escaping + empty input.
assert.equal(recordsToCsv([]).split("\n").length, 1, "empty registry → header only");
const quoted = recordsToCsv([{ email: 'a"b@x.com', name: "X", tier: "pro", key: "kkkkkkkkkkkk", subscription_id: "s", issued_at: "", status: "active" }]);
assert.ok(quoted.includes('"a""b@x.com"'), "double-quotes escaped");
t();

assert.equal(n, 6, "6 registry-API test groups");
console.log(`Sentinel-licenses-api test passed (${n} groups · admin auth · filter/sort · revoke · key-hash lookup · masked CSV).`);
