// RUN 16 §E — Privacy battery. The release-blocking content-blind proof at scale:
//   • 10,000-input fuzz (laced with canary PII) through sanitizeToSignature — ZERO leaks.
//   • 6-host telemetry allowlist UNCHANGED · update +2 paths · ARIA-brain +2 paths (RUN 14/15) UNCHANGED.
//   • Globe greetings + self-heal reports carry no user data / paths / PII.
//   • Offline fallback never queues user content for later flush.
import assert from "node:assert/strict";
import { sanitizeToSignature, contentSafeContext, assertContentSafePayload } from "../src/shared/safety.mjs";
import { CAPTURE_HOST_ALLOWLIST, UPDATE_OUTBOUND_PATHS, BRAIN_OUTBOUND_PATHS, EXPECTED_OUTBOUND_PATHS } from "../src/shared/network-capture.mjs";
import { PERIODIC_MESSAGES, dueGreeting } from "../src/shared/globe-greetings.mjs";
import { buildHealReport, isHealReportSafe } from "../src/shared/self-heal.mjs";
import { askAria } from "../src/shared/aria-brain-client.mjs";

// ---- Invariant 1: the runtime allowlists are EXACTLY the RUN 3/14/15 baselines. ----
assert.equal(CAPTURE_HOST_ALLOWLIST.length, 6, "6-host telemetry allowlist unchanged");
assert.deepEqual([...CAPTURE_HOST_ALLOWLIST].sort(), ["*.service-now.com", "127.0.0.1", "::1", "download.iisupp.net", "iisupp.net", "localhost"].sort());
assert.equal(UPDATE_OUTBOUND_PATHS.length, 2, "update channel still exactly 2 paths");
// RUN 31 — the brain channel grew by ONE additive path: aria-kb-query (KB-first, $0). The 6-host allowlist
// is UNCHANGED (aria-kb-query is on the already-allowed iisupp.net host, asserted above) — only the per-class
// brain-path allowlist gained an entry, and this is its explicit guard.
assert.equal(BRAIN_OUTBOUND_PATHS.length, 5, "ARIA-brain now 5 paths (kb-query + chat + research + RUN 33 kb-stats + system-status)");
assert.ok(BRAIN_OUTBOUND_PATHS.includes("/.netlify/functions/aria-kb-query"), "RUN 31 KB-first path present");
assert.ok(BRAIN_OUTBOUND_PATHS.includes("/.netlify/functions/aria-system-status"), "RUN 33 status path present");
assert.equal(EXPECTED_OUTBOUND_PATHS.length, 3, "inbound-data path count unchanged (distinct directions keep it at 3)");

// ---- Invariant 2: 10,000-input content-leak fuzz, ZERO canary survival. ----
let seed = 0x5EED16;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const CANARIES = [
  "jane.doe@contoso.com", "987-65-4320", "046 454 286", "4111 1111 1111 1111",
  "C:\\Users\\jdoe\\Documents\\Q4-Acquisition-Plan.docx", "/Users/jdoe/Documents/Q4-strategy.docx",
  "https://intranet.contoso.com/deals?id=ABC123&token=zzz", "Confidential Acquisition Plan",
  "DESKTOP-9KQ2MJ7", "Bearer abcdef0123456789", "550e8400-e29b-41d4-a716-446655440000"
];
const SIGNALS = ["disk full", "dns error", "blue screen CRITICAL_PROCESS_DIED", "printer offline", "teams stuck", "wifi no internet"];
const FIELDS = ["issue", "title", "originCategory"];
const SOURCES = ["desktop", "extension", "browser", "operator"];

const N = Number(process.env.ARIA_FUZZ_N) || 10000;
let leaks = 0;
for (let i = 0; i < N; i++) {
  const input = { source: pick(SOURCES) };
  input[pick(FIELDS)] = `${pick(SIGNALS)} ${pick(CANARIES)} ${pick(CANARIES)} note#${i}`;
  if (rand() < 0.5) input.url = pick(CANARIES);
  if (rand() < 0.5) input.path = pick(CANARIES);
  const signature = sanitizeToSignature(input);
  const context = contentSafeContext(input);
  const emitted = JSON.stringify({ signature, context });
  for (const c of CANARIES) if (emitted.includes(c)) { leaks++; assert.fail(`LEAK at ${i}: "${c}" survived -> ${emitted}`); }
  assert.equal(assertContentSafePayload({ signature, context }), true, `clean payload falsely rejected at ${i}`);
}
assert.equal(leaks, 0, "zero PII leaks across the fuzz corpus");

// ---- Invariant 3: globe greetings are static, content-blind copy (no path / email / host). ----
const PII_RE = /[A-Z]:\\|\/(Users|home)\/|@[a-z0-9.-]+\.[a-z]{2,}|\d{3}-\d{2}-\d{4}/i;
for (const m of PERIODIC_MESSAGES) assert.doesNotMatch(m, PII_RE, `greeting carries no PII: ${m}`);
const hi = dueGreeting({ launchedMs: 0, now: 3000, lastGreetMs: -Infinity, saidHi: false });
assert.doesNotMatch(hi.message, PII_RE, "launch greeting carries no PII");

// ---- Invariant 4: self-heal reports never leak paths / emails / stack frames even when ids carry them. ----
const report = buildHealReport([{ id: "watcher C:\\Users\\bob\\w.mjs bob@x.com fail", type: "watcher", status: "needs-code-fix" }], { version: "0.1.0" });
assert.ok(isHealReportSafe(report), "self-heal report is content-blind");
assert.doesNotMatch(JSON.stringify(report), /bob|C:\\\\Users|@x\.com/, "no raw path/email in report");

// ---- Invariant 5: wifi-down mid-fix → offline fallback carries NO user content to flush later. ----
const offlineFetch = async () => { throw new Error("ENOTFOUND iisupp.net"); };
const res = await askAria("my email jane@corp.com on C:\\secret\\plan.docx wont open", { fetchImpl: offlineFetch });
assert.equal(res.offline, true, "offline detected");
assert.doesNotMatch(JSON.stringify(res), /jane@corp|C:\\\\secret|plan\.docx/, "offline result holds no user content for later flush");

console.log(`Privacy battery passed (${N} fuzz inputs · 0 leaks · 6-host allowlist + update/brain paths unchanged · greetings + self-heal + offline fallback content-blind).`);
