// malicious-site-policy — gated DECISION-only layer: allow/warn/block-recommend/escalate,
// managed lock refuses user override, NO real block/override, content-blind.
import assert from "node:assert/strict";
import {
  MALICIOUS_SITE_DECISIONS,
  PROTECTION_MODES,
  evaluateMaliciousSite,
  normalizeMaliciousSitePolicy,
  isMaliciousSiteDecisionSafe
} from "../src/shared/malicious-site-policy.mjs";

// ---- decision paths (protection ON, unlocked) ---------------------------------------------
const on = { mode: "on" };

let r = evaluateMaliciousSite(on, { signal: "BROWSER.PAGE.CLEAN", threatLevel: "clean" });
assert.equal(r.decision, "allow", "clean signal → allow");
assert.equal(r.enforced, false, "decision layer never enforces");

r = evaluateMaliciousSite(on, { signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "warning" });
assert.equal(r.decision, "warn", "suspicious signal → warn");
assert.equal(r.threatLevel, "suspicious");

r = evaluateMaliciousSite(on, { signal: "SECURITY.MALICIOUS.SITE", severity: "danger" });
assert.equal(r.decision, "block-recommend", "malicious signal → block-recommend (guidance, not a real block)");
assert.equal(r.enforced, false);

r = evaluateMaliciousSite(on, { signal: "SECURITY.MALWARE.ACTIVE", severity: "critical" });
assert.equal(r.decision, "escalate", "critical signal → escalate");
assert.equal(r.escalationRoute, "SUPPORT.DESK", "escalate exposes a symbolic escalation route");

// derivation without an explicit threatLevel: a security-family code + high severity → critical
r = evaluateMaliciousSite(on, { signal: "SECURITY.PHISH.CONFIRMED", severity: "danger" });
assert.equal(r.threatLevel, "critical");
assert.equal(r.decision, "escalate");

// ---- locked-ON: user override REFUSED with policy_locked ----------------------------------
const lockedOn = { mode: "locked-on" };
r = evaluateMaliciousSite(lockedOn, { signal: "SECURITY.MALICIOUS.SITE", severity: "danger", userOverride: "allow" });
assert.equal(r.policy_locked, true, "locked-on refuses a user override");
assert.equal(r.reason, "policy_locked");
assert.equal(r.decision, "block-recommend", "override is ignored; managed decision stands");

// locked-on still evaluates normally when no override is attempted
r = evaluateMaliciousSite(lockedOn, { signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "warning" });
assert.equal(r.policy_locked, false, "no override attempt → not flagged as locked-refusal");
assert.equal(r.decision, "warn");

// ---- unlocked override IS honored (but never for critical) --------------------------------
r = evaluateMaliciousSite(on, { signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "warning", userOverride: "allow" });
assert.equal(r.decision, "allow", "unlocked policy honors an allow override on a non-critical signal");
assert.equal(r.reason, "user-override-allow");
assert.equal(r.policy_locked, false);

r = evaluateMaliciousSite(on, { signal: "SECURITY.MALWARE.ACTIVE", severity: "critical", userOverride: "allow" });
assert.equal(r.decision, "escalate", "an end user cannot wave through a CRITICAL signal even unlocked");
assert.equal(r.reason, "override-refused-critical");

r = evaluateMaliciousSite(on, { signal: "BROWSER.PAGE.CLEAN", threatLevel: "clean", userOverride: "block" });
assert.equal(r.decision, "block-recommend", "a user asking to block routes to block-recommend");
assert.equal(r.reason, "user-override-block");

// ---- protection OFF (unmanaged) ------------------------------------------------------------
const off = { mode: "off" };
r = evaluateMaliciousSite(off, { signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "warning" });
assert.equal(r.decision, "warn", "off: suspicious still warns");
r = evaluateMaliciousSite(off, { signal: "SECURITY.MALWARE.ACTIVE", severity: "critical" });
assert.equal(r.decision, "escalate", "off: a critical signal is NEVER silently allowed — it still escalates");
assert.equal(r.reason, "protection-off-critical-still-escalates");
r = evaluateMaliciousSite({ mode: "off", silenceWhenOff: true }, { signal: "BROWSER.PAGE.CLEAN", threatLevel: "clean" });
assert.equal(r.decision, "allow", "off + silenceWhenOff allows a clean page");

// ---- locked-OFF: cannot silence a critical escalation, and refuses override ---------------
const lockedOff = { mode: "locked-off", silenceWhenOff: true };
const nLockedOff = normalizeMaliciousSitePolicy(lockedOff);
assert.equal(nLockedOff.locked, true, "locked-off is a locked policy");
assert.equal(nLockedOff.silenceWhenOff, false, "locked-off cannot request silence");
r = evaluateMaliciousSite(lockedOff, { signal: "SECURITY.MALWARE.ACTIVE", severity: "critical", userOverride: "allow" });
assert.equal(r.decision, "escalate", "locked-off: critical still escalates");
assert.equal(r.policy_locked, true, "locked-off refuses the user override");

// ---- normalization + enums -----------------------------------------------------------------
const norm = normalizeMaliciousSitePolicy({ mode: "bogus", decisions: { malicious: "not-a-decision" } });
assert.equal(PROTECTION_MODES.includes(norm.mode), true, "bad mode falls back to a valid mode");
assert.equal(norm.mode, "on", "bad mode → default 'on'");
assert.equal(MALICIOUS_SITE_DECISIONS.includes(norm.decisions.malicious), true, "bad decision override is clamped to the enum");

// every decision path stays inside the allowed enum + passes the content-blind guard
for (const sev of ["notice", "warning", "danger", "critical"]) {
  const out = evaluateMaliciousSite(on, {
    signal: "SECURITY.SUSPICIOUS.SITE",
    severity: sev,
    // deliberately smuggle content-shaped junk in an unread field to prove it never surfaces
    url: "https://evil.example.com/steal?token=abc",
    title: "owner@example.com secret page"
  });
  assert.equal(MALICIOUS_SITE_DECISIONS.includes(out.decision), true, `severity ${sev} yields a valid decision`);
  assert.equal(isMaliciousSiteDecisionSafe(out), true, `decision for ${sev} is content-safe`);
  const text = JSON.stringify(out);
  assert.equal(text.includes("https://"), false, "decision never leaks a URL");
  assert.equal(text.includes("owner@example.com"), false, "decision never leaks an email");
  assert.equal(text.includes("evil.example.com"), false, "decision never leaks a raw domain");
}

console.log("malicious-site-policy test passed (allow/warn/block-recommend/escalate · locked-on refuses override · locked-off critical still escalates · unlocked override honored non-critical only · off never silently allows critical · content-blind · enforced:false everywhere).");
