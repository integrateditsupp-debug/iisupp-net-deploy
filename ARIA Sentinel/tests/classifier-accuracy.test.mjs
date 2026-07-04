// Q-QA1 - public /aria classifier accuracy mirror.
// Uses the repo-level classifier mirror; keeps a per-intent floor instead of one easy aggregate.
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const { classify, looksLikeResolution } = require(path.join(repoRoot, "tests", "aria-classifier-mirror.js"));

const cases = [
  ["I forgot my password and cannot log in", "password"],
  ["Outlook keeps crashing when I open it", "mail"],
  ["VPN will not connect from home", "vpn"],
  ["wifi connected but no internet", "wifi"],
  ["network printer will not print", "printer"],
  ["Teams meeting audio is broken", "kb:teams"],
  ["OneDrive files are not syncing", "kb:onedrive"],
  ["I got a suspicious phishing email", "kb:security"],
  ["Excel keeps crashing and needs repair", "kb:office"],
  ["my RSA SecurID token is out of sync", "kb:rsa"],
  ["permission denied on the shared folder", "kb:permissions"],
  ["talk to a human support agent", "escalation"]
];

const byIntent = new Map();
let pass = 0;
for (const [input, expected] of cases) {
  const got = classify(input);
  const ok = got === expected;
  if (ok) pass++;
  const row = byIntent.get(expected) || { total: 0, pass: 0 };
  row.total++;
  if (ok) row.pass++;
  byIntent.set(expected, row);
  assert.equal(got, expected, `classifier route: ${input}`);
}

assert.ok(pass / cases.length >= 0.8, "overall classifier accuracy is at least 80% on the lock corpus");
for (const [intent, row] of byIntent) {
  assert.ok(row.pass / row.total >= 0.5, `per-intent floor >=50% for ${intent}`);
}

assert.equal(looksLikeResolution("fixed, thanks"), true);
assert.equal(looksLikeResolution("still broken, not fixed"), false);

console.log(`Classifier-accuracy test passed (${pass}/${cases.length} routes; per-intent floor locked; resolution detector sane).`);
