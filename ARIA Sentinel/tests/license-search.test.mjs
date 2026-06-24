// RUN 14 — admin license search (by key / email / name / company) + pagination.
import assert from "node:assert/strict";
import { searchLicenses } from "../src/shared/license-registry.mjs";

const records = [
  { license_key: "AAA", email: "john@acme.com", first_name: "John", last_name: "Doe", company: "Acme Corp" },
  { license_key: "BBB", email: "jane@globex.com", first_name: "Jane", last_name: "Roe", company: "Globex" },
  { license_key: "CCC", email: "jim@acme.com", first_name: "Jim", last_name: "Poe", company: "Acme Corp" }
];

// By first name.
assert.equal(searchLicenses(records, "john").total, 1);
assert.equal(searchLicenses(records, "john").results[0].license_key, "AAA");
// By company (case-insensitive) → 2 Acme.
assert.equal(searchLicenses(records, "acme").total, 2);
// By license key.
assert.equal(searchLicenses(records, "BBB").results[0].email, "jane@globex.com");
// By email substring.
assert.equal(searchLicenses(records, "globex.com").total, 1);
// Empty query → all.
assert.equal(searchLicenses(records, "").total, 3);
// No match.
assert.equal(searchLicenses(records, "zzz").total, 0);

// Pagination.
const p = searchLicenses(records, "", { page: 1, pageSize: 2 });
assert.equal(p.results.length, 2);
assert.equal(p.pages, 2);
assert.equal(searchLicenses(records, "", { page: 2, pageSize: 2 }).results.length, 1);

console.log("License-search test passed (key/email/name/company substring · pagination).");
