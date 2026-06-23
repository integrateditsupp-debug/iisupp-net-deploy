// RUN 35-6 — 2000-sample LIVE stress test of the Sentinel aria-kb-query endpoint.
// Weighted: 200 per top-10 KB intent + 200 fallthrough. Batches of 25 in parallel, 8s timeout each.
// Scores by mapping the corpus intent → an expected slug family on the returned article.
// Usage: node tests/run-sentinel-kb-live-sample.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const corpus = require("./scenario-corpus-mega.js");

const ENDPOINT = "https://iisupp.net/.netlify/functions/aria-kb-query";
// The live endpoint rate-limits bursts (a correct production feature). A full 2000-in-batches-of-25 run from one
// IP is intentionally throttled, so we sample at a rate-limit-respecting pace: small batches + per-batch gap +
// exponential retry. PER is overridable via env for a larger/slower run. Default 50/intent ≈ 550 queries.
const PER = Number(process.env.PER || 50), BATCH = 4, TIMEOUT = 8000, GAP_MS = 900;
const RETRY_BACKOFF = [1500, 3500];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Corpus intent → regex the returned article slug must satisfy. Fallthrough intents expect NO confident match.
const SLUG = {
  printer: /printer/i, wifi: /wifi/i, "kb:security": /(malware|security)/i, "kb:teams": /teams/i,
  vpn: /vpn/i, password: /password/i, "kb:mfa": /mfa/i, "kb:onedrive": /onedrive/i,
  "kb:m365": /(m365|office|outlook|azure|m-365)/i, mail: /(email|outlook|exchange|mail)/i,
  "kb:windows": /windows/i, "kb:bluetooth": /bluetooth/i, "kb:browser": /browser/i, "kb:webcam": /(webcam|camera)/i,
};
const FALLTHROUGH = new Set(["default", "weather/news", "trade", "quote", "shopping", "voice", "news", "not-resolution"]);

// Deterministic weighted sample (every Nth within an intent group — no RNG).
function sample() {
  const byIntent = {};
  for (const it of corpus) { (byIntent[it.expect] ||= []).push(it.q); }
  const wanted = Object.keys(SLUG).sort((a, b) => (byIntent[b]?.length || 0) - (byIntent[a]?.length || 0)).slice(0, 10);
  const out = [];
  const take = (intent, n, kind) => {
    const pool = byIntent[intent] || []; if (!pool.length) return;
    const step = Math.max(1, Math.floor(pool.length / n));
    for (let i = 0, c = 0; c < n && i < pool.length; i += step, c++) out.push({ q: pool[i], intent, kind });
  };
  for (const intent of wanted) take(intent, PER, "kb");
  // 200 fallthrough, spread across the fallthrough intents.
  const ftIntents = [...FALLTHROUGH].filter((i) => byIntent[i]?.length);
  const perFt = Math.ceil(PER / ftIntents.length);
  for (const intent of ftIntents) take(intent, perFt, "fallthrough");
  return out.slice(0, 2200);
}

async function queryOnce(q) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(TIMEOUT),
    });
    const txt = await res.text();
    if (!res.ok) return { ok: false, status: res.status };
    try { return { ok: true, body: JSON.parse(txt) }; } catch { return { ok: false, error: "nonjson" }; }
  } catch (e) { return { ok: false, error: String(e.name || e) }; }
}
// Retries with exponential backoff on a transient network/rate-limit error — removes batch-pressure noise.
async function query(q) {
  let r = await queryOnce(q);
  for (const wait of RETRY_BACKOFF) { if (r.ok) break; await sleep(wait); r = await queryOnce(q); }
  return r;
}

function score(item, r) {
  if (!r.ok) return { pass: false, reason: "neterr:" + (r.error || r.status), got: "" };
  const b = r.body || {};
  const slug = (b.article && b.article.slug) || "";
  const matched = b.match === true && Number(b.confidence) > 0;
  if (item.kind === "fallthrough") {
    // A confident KB hit on a non-IT query is a miss; no/low match is a pass.
    return { pass: !matched || Number(b.confidence) < 12, got: matched ? slug : "(no-match)" };
  }
  const re = SLUG[item.intent];
  return { pass: matched && re && re.test(slug), got: slug || "(no-match)" };
}

async function main() {
  const items = sample();
  console.log(`Sampled ${items.length} queries (${PER}/intent × top-10 + ~${PER} fallthrough). Hitting ${ENDPOINT} …`);
  const results = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const rs = await Promise.all(slice.map((it) => query(it.q)));
    slice.forEach((it, j) => results.push({ ...it, ...score(it, rs[j]) }));
    if ((i / BATCH) % 10 === 0) process.stdout.write(`  ${i + slice.length}/${items.length}\r`);
    await sleep(GAP_MS);
  }
  const pass = results.filter((r) => r.pass).length;
  const byIntent = {};
  for (const r of results) { const k = r.kind === "fallthrough" ? "FALLTHROUGH" : r.intent; (byIntent[k] ||= { t: 0, p: 0 }); byIntent[k].t++; if (r.pass) byIntent[k].p++; }
  const neterr = results.filter((r) => String(r.reason || "").startsWith("neterr")).length;
  const report = {
    endpoint: ENDPOINT, total: results.length, pass, fail: results.length - pass,
    pct: +((pass / results.length) * 100).toFixed(2), neterr,
    by_intent: Object.fromEntries(Object.entries(byIntent).map(([k, v]) => [k, `${v.p}/${v.t} (${((v.p / v.t) * 100).toFixed(0)}%)`])),
    top_failures: results.filter((r) => !r.pass).slice(0, 50).map((r) => ({ intent: r.intent, q: r.q.slice(0, 90), got: r.got, reason: r.reason || "" })),
  };
  fs.writeFileSync(new URL("./last-sentinel-kb-live.json", import.meta.url), JSON.stringify(report, null, 2));
  console.log(`\n========== SENTINEL aria-kb-query LIVE SAMPLE ==========`);
  console.log(`Total ${report.total} · Pass ${pass} (${report.pct}%) · Fail ${report.fail} · net errors ${neterr}`);
  console.log("--- by intent ---");
  for (const [k, v] of Object.entries(report.by_intent)) console.log("  " + k.padEnd(16), v);
  console.log("report → tests/last-sentinel-kb-live.json");
}
main();
