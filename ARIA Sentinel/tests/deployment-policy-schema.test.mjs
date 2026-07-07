// deployment-policy-schema — per-customer policy object the managed/admin lock consumes.
// Accepts good configs, rejects malformed ones with clear error codes.
import assert from "node:assert/strict";
import {
  DEPLOYMENT_POLICY_SCHEMA_VERSION,
  OVERRIDE_RULES,
  ESCALATION_ROUTES,
  validateDeploymentPolicy,
  isDeploymentPolicyValid
} from "../src/shared/deployment-policy-schema.mjs";

// ---- a fully-specified good config -----------------------------------------------------------
const good = {
  customerId: "acme-corp_01",
  browserProtection: "on",
  maliciousSitePolicy: {
    decisions: { clean: "allow", suspicious: "warn", malicious: "block-recommend", critical: "escalate" }
  },
  overrideRules: "allow-warn",
  escalationRouting: "managed-soc"
};
let res = validateDeploymentPolicy(good);
assert.equal(res.valid, true, "a well-formed policy validates");
assert.deepEqual(res.errors, []);
assert.equal(res.policy.v, DEPLOYMENT_POLICY_SCHEMA_VERSION);
assert.equal(res.policy.customerId, "acme-corp_01");
assert.equal(res.policy.browserProtection, "on");
assert.equal(res.policy.locked, false);
assert.equal(res.policy.maliciousSitePolicy.decisions.critical, "escalate");
assert.equal(res.policy.overrideRules, "allow-warn");
assert.equal(res.policy.escalationRouting, "managed-soc");
assert.equal(isDeploymentPolicyValid(good), true);

// ---- decisions may be given flat (no nested "decisions" wrapper) -----------------------------
res = validateDeploymentPolicy({
  customerId: "flat1",
  browserProtection: "off",
  maliciousSitePolicy: { suspicious: "warn", malicious: "escalate" }
});
assert.equal(res.valid, true, "flat decision map is accepted");
assert.equal(res.policy.maliciousSitePolicy.decisions.malicious, "escalate");

// ---- locked-on with no overrides is valid; defaults fill in ----------------------------------
res = validateDeploymentPolicy({
  customerId: "locked1",
  browserProtection: "locked-on",
  maliciousSitePolicy: { decisions: { critical: "escalate" } }
});
assert.equal(res.valid, true, "locked-on with no override is valid");
assert.equal(res.policy.locked, true);
assert.equal(res.policy.overrideRules, "none", "override defaults to none");
assert.equal(res.policy.escalationRouting, "support-desk", "escalation defaults to support-desk");

// ---- REJECTIONS with clear error codes -------------------------------------------------------
assert.deepEqual(validateDeploymentPolicy(null).errors, ["policy-must-be-object"], "non-object rejected");
assert.deepEqual(validateDeploymentPolicy("nope").errors, ["policy-must-be-object"]);

res = validateDeploymentPolicy({ browserProtection: "on", maliciousSitePolicy: { decisions: {} } });
assert.equal(res.valid, false);
assert.ok(res.errors.includes("customerId-required"), "missing customerId is flagged");

res = validateDeploymentPolicy({ customerId: "c1", browserProtection: "sometimes", maliciousSitePolicy: { decisions: {} } });
assert.equal(res.valid, false);
assert.ok(res.errors.includes("browserProtection-invalid"), "bad protection mode is flagged");

res = validateDeploymentPolicy({ customerId: "c1", browserProtection: "on" });
assert.equal(res.valid, false);
assert.ok(res.errors.includes("maliciousSitePolicy-required"), "missing malicious-site policy is flagged");

res = validateDeploymentPolicy({
  customerId: "c1", browserProtection: "on",
  maliciousSitePolicy: { decisions: { malicious: "delete-the-drive" } }
});
assert.equal(res.valid, false);
assert.ok(res.errors.some((e) => e.startsWith("maliciousSitePolicy-invalid-decision")), "bogus decision is flagged");

res = validateDeploymentPolicy({
  customerId: "c1", browserProtection: "on",
  maliciousSitePolicy: { decisions: { nonsense: "warn" } }
});
assert.equal(res.valid, false);
assert.ok(res.errors.some((e) => e.startsWith("maliciousSitePolicy-unknown-level")), "unknown threat level is flagged");

res = validateDeploymentPolicy({
  customerId: "c1", browserProtection: "on",
  maliciousSitePolicy: { decisions: { suspicious: "warn" } }, overrideRules: "let-users-do-anything"
});
assert.equal(res.valid, false);
assert.ok(res.errors.includes("overrideRules-invalid"), "bad override rule is flagged");

// locked protection + a granted override is a contradiction and must be rejected
res = validateDeploymentPolicy({
  customerId: "c1", browserProtection: "locked-off",
  maliciousSitePolicy: { decisions: { critical: "escalate" } }, overrideRules: "allow-suspicious"
});
assert.equal(res.valid, false);
assert.ok(res.errors.includes("locked-protection-cannot-allow-override"), "locked mode cannot also grant overrides");

res = validateDeploymentPolicy({
  customerId: "c1", browserProtection: "on",
  maliciousSitePolicy: { decisions: { suspicious: "warn" } }, escalationRouting: "call-the-ceo"
});
assert.equal(res.valid, false);
assert.ok(res.errors.includes("escalationRouting-invalid"), "bad escalation route is flagged");

// sanity: the exported enums are the ones the validator honors
assert.ok(OVERRIDE_RULES.includes("none") && ESCALATION_ROUTES.includes("support-desk"));

console.log("deployment-policy-schema test passed (good config accepted · flat+nested decisions · locked defaults · rejects: non-object/missing-id/bad-mode/missing-msp/bad-decision/unknown-level/bad-override/locked+override contradiction/bad-route).");
