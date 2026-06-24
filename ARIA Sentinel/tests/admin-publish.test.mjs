// RUN 14 — admin-token gate for publish/rollback/search. Token comes only from ARIA_ADMIN_TOKEN env.
import assert from "node:assert/strict";
import { requireAdminToken } from "../src/shared/admin-auth.mjs";

const env = { ARIA_ADMIN_TOKEN: "s3cr3t-admin-token" };

// Valid token → 200.
assert.deepEqual(requireAdminToken({ "x-admin-token": "s3cr3t-admin-token" }, env), { ok: true, status: 200, reason: "ok" });
// Case-variant header key accepted.
assert.equal(requireAdminToken({ "X-Admin-Token": "s3cr3t-admin-token" }, env).ok, true);
// Missing header → 401.
assert.equal(requireAdminToken({}, env).status, 401);
// Wrong token → 401.
assert.equal(requireAdminToken({ "x-admin-token": "nope" }, env).status, 401);
// Token not configured in env → 401 (never allow without a configured token).
assert.equal(requireAdminToken({ "x-admin-token": "anything" }, {}).status, 401);
// No hardcoded fallback: empty configured + empty provided still denied.
assert.equal(requireAdminToken({ "x-admin-token": "" }, { ARIA_ADMIN_TOKEN: "" }).ok, false);

console.log("Admin-publish test passed (X-Admin-Token vs ARIA_ADMIN_TOKEN env · 401 paths · no hardcoded token).");
