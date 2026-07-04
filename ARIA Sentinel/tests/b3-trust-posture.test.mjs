// RUN-B B3 - honest trust/security posture: no over-claim, real-or-empty metrics.
import assert from "node:assert/strict";
import { buildTrustSummary } from "../src/shared/trust-posture.mjs";

let trust = buildTrustSummary({ resolutionEvents: [], fixes: 0 });
assert.equal(trust.metrics.deflectionPct, null);
assert.ok(trust.caveats.length > 0, "empty state carries caveat instead of inflated claim");
assert.ok(trust.claims.some((c) => /No fabricated/i.test(c)));
assert.doesNotMatch(JSON.stringify(trust), /100%|guaranteed|certified/i);

trust = buildTrustSummary({ resolutionEvents: [{ outcome: "resolved", resolved: true }], fixes: 1, auditOk: true });
assert.equal(trust.auditIntegrity, "ok");
assert.equal(trust.metrics.fixes, 1);
assert.equal(trust.metrics.deflectionPct, 100);

console.log("B3 trust-posture test passed (real-or-empty, no inflated trust claims, measured metrics only).");
