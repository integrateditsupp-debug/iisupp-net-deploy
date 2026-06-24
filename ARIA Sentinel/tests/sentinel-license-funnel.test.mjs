// RUN 24 A2 — auto-license-funnel pure logic: plan mapping, mint/record shape, idempotency, emails, R11.
import assert from "node:assert/strict";
import {
  planFromLookupKey, mintLicense, shouldMint, customerEmail, adminEmail, maskKey, scrubField, DOWNLOADS_URL
} from "../src/shared/sentinel-license-funnel.mjs";
import { resolvePlanFromKey } from "../src/shared/license-features.mjs";

const SECRET = "funnel-test-secret";
let n = 0; const t = () => { n++; };

// 1 — plan mapping covers RUN 23e sentinel_* keys, RUN 23f canonical IDs, and bare names; unknown → null.
assert.equal(planFromLookupKey("sentinel_personal_m"), "personal");
assert.equal(planFromLookupKey("sentinel_pro_m"), "pro");
assert.equal(planFromLookupKey("sentinel_business_y"), "smb");
assert.equal(planFromLookupKey("sentinel_midsize_y"), "midsize");
assert.equal(planFromLookupKey("sentinel_enterprise_y"), "enterprise");
assert.equal(planFromLookupKey("small_business"), "smb", "RUN 23f canonical id");
assert.equal(planFromLookupKey("mid_size"), "midsize");
assert.equal(planFromLookupKey("PRO"), "pro", "case-insensitive");
assert.equal(planFromLookupKey("garbage"), null, "unknown key → null (never guess)");
assert.equal(planFromLookupKey(null), null);
assert.equal(planFromLookupKey("", "enterprise"), "enterprise", "tier metadata fallback");
assert.equal(planFromLookupKey("", "admin"), null, "admin is never a purchasable plan from the funnel");
t();

// 2 — mintLicense builds the Blobs record; the key round-trips back to the canonical plan.
const rec = mintLicense({ email: "Jane@Acme.com", name: "Jane", plan: "pro", subscription_id: "sub_1", customer_id: "cus_1", secret: SECRET, issued_at: "2026-06-22T00:00:00.000Z" });
assert.equal(rec.tier, "pro");
assert.equal(rec.status, "active");
assert.equal(rec.subscription_id, "sub_1");
assert.equal(rec.customer_id, "cus_1");
assert.match(rec.key, /^[a-f0-9]{64}$/);
assert.equal(resolvePlanFromKey(rec.key, SECRET), "pro", "minted key resolves to its plan");
t();

// 3 — idempotency.
assert.equal(shouldMint(null), true, "no record yet → mint");
assert.equal(shouldMint(undefined), true);
assert.equal(shouldMint(rec), false, "already minted → skip");
t();

// 4 — customer email contains the key + the public /downloads link + the tier label.
const ce = customerEmail(rec);
assert.match(ce.subject, /license is ready/i);
assert.ok(ce.text.includes(rec.key), "customer email contains the key");
assert.ok(ce.text.includes(DOWNLOADS_URL), "customer email links /downloads");
assert.ok(ce.text.includes("Pro"), "customer email names the tier");
t();

// 5 — 🔒 admin email shows a MASKED key, never the raw key.
const ae = adminEmail(rec);
assert.ok(!ae.text.includes(rec.key), "admin email never contains the raw key");
assert.ok(ae.text.includes(maskKey(rec.key)), "admin email shows the masked key");
assert.match(maskKey(rec.key), /^.{4}….{4}$/, "mask is XXXX…XXXX");
assert.ok(ae.text.includes("cus_1") && ae.text.includes("sub_1"), "admin email has the Stripe ids");
t();

// 6 — 🔒 the SECRET never appears in any record or email.
for (const blob of [JSON.stringify(rec), ce.text, ce.subject, ae.text, ae.subject]) {
  assert.ok(!blob.includes(SECRET), "secret never leaks into a record or email");
}
t();

// 7 — 🔒 R11: path-shaped name/email fields are scrubbed before persistence.
assert.equal(scrubField("C:\\Users\\ahmad\\secret"), "[path]", "windows path scrubbed");
assert.equal(scrubField("/Users/ahmad/secret"), "[path]", "unix path scrubbed");
assert.equal(scrubField("Jane Doe"), "Jane Doe", "ordinary name is untouched");
const scrubbed = mintLicense({ email: "a@b.com", name: "C:\\Users\\bob\\stuff", plan: "personal", subscription_id: "s", customer_id: "c", secret: SECRET });
assert.ok(!scrubbed.name.includes("bob"), "record name is path-scrubbed");
t();

assert.equal(n, 7, "7 funnel test groups");
console.log(`Sentinel-license-funnel test passed (${n} groups · plan map · mint+record · idempotency · emails · masked admin key · no-secret-leak · R11 scrub).`);
