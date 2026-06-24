// BLOCK 7 test — the single most important test in the codebase.
// Generate 1000 fuzzed inputs laced with canary PII (emails, SSNs, SINs, cards, full file
// paths, URLs with query strings, confidential document titles). Run each through the
// content-blind pipeline and assert:
//   (a) sanitizeToSignature() output contains NONE of the canaries, and
//   (b) assertContentSafePayload() never falsely rejects a clean symbolic payload.
// A single leak = release block.
import assert from "node:assert/strict";
import { sanitizeToSignature, contentSafeContext, assertContentSafePayload } from "../src/shared/safety.mjs";

// Deterministic PRNG (no Math.random) so any failure reproduces exactly.
let seed = 0xC0FFEE;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const CANARIES = [
  "jane.doe@contoso.com",
  "987-65-4320",            // SSN
  "046 454 286",           // SIN
  "4111 1111 1111 1111",   // card
  "C:\\Users\\jdoe\\Documents\\Q4-Acquisition-Plan.docx",
  "/Users/jdoe/Documents/Q4-strategy.docx",
  "https://intranet.contoso.com/deals/redacted?id=ABC123&token=zzz",
  "Confidential Acquisition Plan",
  "Project Bluebird merger memo",
  "DESKTOP-9KQ2MJ7",
  "Bearer abcdef0123456789abcdef0123456789",
  "550e8400-e29b-41d4-a716-446655440000"
];

// Symbolic signals that SHOULD survive (we want classification to still work).
const SIGNALS = ["disk full", "dns error", "blue screen CRITICAL_PROCESS_DIED", "printer offline", "teams stuck", "wifi no internet", "zoom too big"];
const SOURCES = ["desktop", "extension", "browser", "operator"];
const FIELDS = ["issue", "title", "originCategory"];

function fuzzInput(i) {
  const input = { source: pick(SOURCES) };
  // Stuff several canaries into free-text fields, alongside a real signal phrase.
  const blob = `${pick(SIGNALS)} ${pick(CANARIES)} ${pick(CANARIES)} note#${i}`;
  input[pick(FIELDS)] = blob;
  // Sometimes also inject canary-bearing url/path fields directly.
  if (rand() < 0.5) input.url = pick(CANARIES);
  if (rand() < 0.5) input.path = pick(CANARIES);
  if (rand() < 0.3) input.signal = `${pick(SIGNALS)} ${pick(CANARIES)}`;
  return input;
}

let leaks = 0;
let classified = 0;
const N = Number(process.env.ARIA_FUZZ_N) || 1500; // nightly CI sets ARIA_FUZZ_N=10000

for (let i = 0; i < N; i++) {
  const input = fuzzInput(i);

  const signature = sanitizeToSignature(input);
  const context = contentSafeContext(input);
  const emitted = JSON.stringify({ signature, context });

  for (const canary of CANARIES) {
    if (emitted.includes(canary)) {
      leaks++;
      assert.fail(`LEAK at input ${i}: canary "${canary}" survived -> ${emitted}`);
    }
  }

  // The emitted signature must itself pass the content-safety gate without false reject.
  assert.equal(assertContentSafePayload({ signature, context }), true, `clean symbolic payload falsely rejected at ${i}`);

  // Classification should still produce a symbolic code (never raw text).
  assert.match(signature.code, /^[A-Z]/);
  if (signature.code !== "UNKNOWN.SIGNAL") classified++;
}

// assertContentSafePayload is the egress BACKSTOP: it must reject payloads carrying
// pattern-detectable PII (email, url, SSN, SIN, card). It is not expected to catch free
// English (e.g. a document title) — such strings never reach a payload because
// sanitizeToSignature collapses them to a symbolic code (proven by the 1000-input run above).
const PATTERN_PII = [
  "jane.doe@contoso.com",
  "https://intranet.contoso.com/x?id=1",
  "987-65-4320",
  "046 454 286",
  "4111 1111 1111 1111"
];
for (const canary of PATTERN_PII) {
  assert.equal(assertContentSafePayload({ note: canary }), false, `gate must reject patterned PII "${canary}"`);
}

assert.equal(leaks, 0, "zero canary leaks required to ship");
console.log(`Content-leak fuzz passed (${N} inputs, 0 leaks, ${classified} still classified to a symbolic code).`);
