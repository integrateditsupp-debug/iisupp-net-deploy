// Corporate rescue RDP policy foundation: no hidden access, no blue-screen claim, temporary by default.
import assert from "node:assert/strict";
import {
  DEFAULT_RDP_GRANT_MINUTES,
  classifyDeviceForRdp,
  validateAuthorityConfig,
  validateRdpGrantRequest,
  buildRdpGrantRecord,
  markExpiredRdpGrants,
  revokeRdpGrant,
  secretFreeAudit,
  validRdpTargetUser
} from "../src/shared/rdp-access.mjs";

const NOW = Date.parse("2026-07-04T12:00:00.000Z");
const authority = {
  enabled: true,
  model: "local_endpoint_service",
  endpointServiceApproved: true,
  signedCommandsRequired: true,
  maxDurationMinutes: 120
};
const device = {
  host: "LAPTOP-7F3K2MJ",
  enrolled: true,
  online: true,
  agentReachable: true,
  windowsReachable: true,
  rdpAvailable: true
};
const actor = { email: "admin@company.com", role: "Admin" };

assert.equal(validateAuthorityConfig(authority).ok, true, "approved signed local endpoint authority is valid");
assert.deepEqual(
  validateAuthorityConfig({ ...authority, password: "never-store-this" }).errors,
  ["secret-metadata-forbidden"],
  "secret-looking authority metadata is forbidden"
);

assert.equal(classifyDeviceForRdp(device).canRequest, true, "online enrolled reachable device can be requested");
const bsod = classifyDeviceForRdp({ host: "WS-01F23", enrolled: true, blueScreenSuspected: true, online: false });
assert.equal(bsod.canRequest, false);
assert.equal(bsod.state, "blue_screen_suspected");
assert.match(bsod.reason, /cannot RDP into a true blue screen/i, "UI must not claim blue-screen RDP works");
assert.ok(bsod.recoveryOptions.some((x) => /OneDrive|SharePoint/.test(x)), "safe recovery alternatives are returned");

assert.equal(validRdpTargetUser("CORP\\jdoe"), true);
assert.equal(validRdpTargetUser("jdoe@company.com"), true);
assert.equal(validRdpTargetUser("AzureAD\\jdoe@company.com"), true);
assert.equal(validRdpTargetUser("localuser"), false, "local-only user needs explicit policy opt-in");
assert.equal(validRdpTargetUser("localuser", { allowLocalUser: true }), true);

let decision = validateRdpGrantRequest({
  actor: { role: "Read-only" },
  authority,
  device,
  targetUser: "CORP\\jdoe",
  reason: "INC12345",
  durationMinutes: 60
});
assert.equal(decision.ok, false);
assert.ok(decision.errors.includes("admin-not-authorized"));

decision = validateRdpGrantRequest({
  actor,
  authority,
  device,
  targetUser: "CORP\\jdoe",
  reason: "INC12345",
  durationMinutes: 240
});
assert.equal(decision.ok, false);
assert.ok(decision.errors.includes("duration-exceeds-policy"));

const built = buildRdpGrantRecord({
  actor,
  authority,
  device,
  targetUser: "CORP\\jdoe",
  reason: "INC12345 password=abc123 recover payroll file",
  durationMinutes: DEFAULT_RDP_GRANT_MINUTES
}, { now: NOW });
assert.equal(built.ok, true);
assert.equal(built.record.schema, "rdp-grant.v1");
assert.equal(built.record.state, "active");
assert.equal(built.record.revokeStatus, "scheduled");
assert.equal(built.record.expiresAt, new Date(NOW + DEFAULT_RDP_GRANT_MINUTES * 60 * 1000).toISOString());
assert.doesNotMatch(JSON.stringify(built.record), /abc123/, "audit/record text redacts secret-shaped values");

const expired = markExpiredRdpGrants([built.record], { now: NOW + 61 * 60 * 1000 })[0];
assert.equal(expired.state, "expired_pending_revoke");
assert.equal(expired.revokeStatus, "pending");

const revoked = revokeRdpGrant(expired, { by: "admin@company.com", at: NOW + 62 * 60 * 1000 });
assert.equal(revoked.state, "revoked");
assert.equal(revoked.revokeStatus, "success");
assert.equal(revoked.revokedBy, "admin@company.com");

const failed = revokeRdpGrant(expired, { ok: false, error: "token=secret failed" });
assert.equal(failed.state, "revoke_failed");
assert.doesNotMatch(failed.revokeError, /secret/);

const audit = secretFreeAudit("RDP_GRANT", { admin: "a", token: "secret", note: "password=hunter2" });
assert.equal(audit.secretFree, true);
assert.equal("token" in audit.details, false);
assert.doesNotMatch(JSON.stringify(audit), /hunter2/);

console.log("RDP access policy test passed (admin-only, customer authority, device states, temporary grant, revoke, secret-free audit).");
