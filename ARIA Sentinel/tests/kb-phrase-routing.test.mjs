// Phase F (D1 lane closure) — LIVE-PATH KB routing regression for the "stuck Windows update" defect.
//
// ROOT CAUSE the desktop actually hit: ARIA desktop Chat's KB-first tier calls askAria() → the REMOTE
// aria-kb-query function, whose scorer (netlify/functions/aria-kb-query.mjs `score` + `ROUTING`) ranks the
// 203-chunk web KB (assets/aria-kb-chunks.json). "stuck Windows update" had NO routing rule there, so a bare
// "update"/"windows" token overlap let the AUDIO article (l1-windows-005 — its body says "Recent Windows
// Update broke audio") win right at the confidence floor. The earlier regression only exercised the OFFLINE
// local-KB matcher (aria-local-kb.mjs + aria-kb-pack) — a DIFFERENT code path — so it passed green while the
// live app mis-routed. This suite now pins ALL of the live layers so the test reflects what the app runs:
//   1. the exact live server scorer (score/ROUTING over the real shipped chunks),
//   2. the web /aria twin's routeIds (assets/aria-kb-retrieval.mjs),
//   3. the desktop askAria() relevance floor (isRelevantKbMatch) — the layer a desktop REBUILD verifies,
//   4. the offline local-KB fallback (still valid — answers when the brain is unreachable).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { score } from "../../netlify/functions/aria-kb-query.mjs";
import { routeIds } from "../../assets/aria-kb-retrieval.mjs";
import { askAria, isRelevantKbMatch } from "../src/shared/aria-brain-client.mjs";
import { matchKb, loadKbPack, stemBigrams, localKbAnswer } from "../src/shared/aria-local-kb.mjs";

const root = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(root, "..");
const chunks = JSON.parse(fs.readFileSync(path.join(repoRoot, "assets", "aria-kb-chunks.json"), "utf8")).chunks || [];
assert.ok(chunks.length > 150, "real web KB (aria-kb-chunks.json) loaded");

const AUDIO = "l1-windows-005-audio-no-sound";
const UPDATE = "l1-windows-007-update-stuck-reboot-loop";
const REVERT = "l1-windows-008-update-keeps-reverting";

// ── 1 — LIVE SERVER SCORER: mirror the aria-kb-query handler's ranking (score → filter>0 → sort → floor 8). ──
function liveTop(q) {
  const scored = chunks.map((c) => ({ slug: c.slug, s: score(q, c) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const top = scored[0] || null;
  return { slug: top && top.slug, score: top ? top.s : 0, confident: !!top && top.s >= 8 };
}
// D1: the stuck-update ask must NOT confidently return the audio article; it routes to the update article.
{
  const t = liveTop("how do I fix a stuck Windows update?");
  assert.notEqual(t.slug, AUDIO, "D1: stuck-update must NOT top the audio article on the live scorer");
  assert.equal(t.slug, UPDATE, "stuck-update routes to the update article that exists in the KB");
  assert.ok(t.confident, "and it clears the confidence floor (a real, correct answer)");
}
assert.equal(liveTop("windows update won't install").slug, UPDATE, "update-not-installing -> update article");
assert.equal(liveTop("update keeps reverting on restart").slug, REVERT, "reverting-update -> -008 article");
// contrast queries the fix must NOT disturb:
assert.equal(liveTop("audio not working there is no sound").slug, AUDIO, "audio route unchanged (real no-sound query)");
assert.equal(liveTop("printer not printing").slug, "l1-printer-001-not-printing", "printer route unchanged");
// honest abstain: out-of-scope stays below the confidence floor (no confident match).
for (const q of ["book me a flight to new york", "what is the weather tomorrow"]) {
  assert.equal(liveTop(q).confident, false, `out-of-scope "${q}" stays below the floor (abstain)`);
}

// ── 2 — WEB /aria TWIN routeIds (assets/aria-kb-retrieval.mjs) mirrors the same routing. ──
assert.ok(routeIds("stuck windows update").includes("l1-windows-007"), "twin routes stuck-update -> l1-windows-007");
assert.ok(!routeIds("how do I fix a stuck Windows update?").includes("l1-windows-005"), "twin does NOT route stuck-update -> audio");
assert.ok(routeIds("audio not working no sound").includes("l1-windows-005"), "twin audio route intact");

// ── 3 — DESKTOP relevance floor (the layer a rebuild verifies): askAria + isRelevantKbMatch. ──
// unit: the content-blind gate (slug/title only) rejects an off-topic article and accepts on-topic ones.
assert.equal(isRelevantKbMatch("how do I fix a stuck Windows update?", { slug: AUDIO, title: "Windows: no sound at all from the computer" }), false,
  "D1: the audio article is judged OFF-topic for a stuck-update ask");
assert.equal(isRelevantKbMatch("how do I fix a stuck Windows update?", { slug: UPDATE, title: "" }), true, "the update article is on-topic");
assert.equal(isRelevantKbMatch("no sound from my pc", { slug: AUDIO, title: "" }), true, "a real no-sound ask <-> audio article is on-topic");
assert.equal(isRelevantKbMatch("printer not printing", { slug: "l1-printer-001-not-printing", title: "" }), true, "printer stays on-topic");

// integration: askAria (the SAME function the desktop chat calls) with a mocked aria-kb-query response.
const makeFetch = (kb, chatText = "Anthropic fallback answer") => async (url) =>
  String(url).includes("aria-kb-query")
    ? { ok: true, json: async () => kb }
    : { ok: true, json: async () => ({ text: chatText, sessionId: "s1" }) };
// the exact live mis-match payload (a CONFIDENT audio article for a stuck-update ask) is REJECTED, not served.
{
  const wrong = { match: true, confidence: 30, article: { slug: AUDIO, title: "Windows: no sound at all from the computer", tier: "L1", url: "https://iisupp.net/aria?article=" + AUDIO }, content_excerpt: "Recent Windows Update broke audio (rare)..." };
  const r = await askAria("how do I fix a stuck Windows update?", { fetchImpl: makeFetch(wrong) });
  assert.notEqual(r.action, "kb-match", "D1 LIVE: a confident-but-off-topic audio match is NOT served as a KB answer");
}
// a confident, on-topic update match IS served ($0 KB answer).
{
  const right = { match: true, confidence: 30, article: { slug: UPDATE, title: "", tier: "L1", url: "https://iisupp.net/aria?article=" + UPDATE }, content_excerpt: "Reset the Windows Update cache (SoftwareDistribution), then restart the update services." };
  const r = await askAria("how do I fix a stuck Windows update?", { fetchImpl: makeFetch(right) });
  assert.equal(r.action, "kb-match", "the correct update article is served confidently");
  assert.equal(r.kb_match.slug, UPDATE);
}
// an on-topic match on an unrelated topic still passes the gate (no over-blocking of good answers).
{
  const wifi = { match: true, confidence: 27, article: { slug: "l1-wifi-003-keeps-dropping-intermittent", title: "", tier: "L1" }, content_excerpt: "Forget the network and rejoin; update the wireless driver." };
  const r = await askAria("wifi keeps dropping every few minutes", { fetchImpl: makeFetch(wifi) });
  assert.equal(r.action, "kb-match", "an on-topic wifi match is still served (gate does not over-block)");
}

// ── 4 — OFFLINE local-KB fallback (aria-local-kb.mjs + aria-kb-pack) — the desktop's brain-unreachable path. ──
// Still valid and still correct: preserved, not the live defect's path. This is what answers when the brain is
// unreachable, and (post-fix) also what the desktop shows after the relevance floor rejects an off-topic remote
// match with external AI disabled — routing the stuck-update ask to update-stuck.md.
const index = loadKbPack(path.join(root, "aria-kb-pack"), fs);
assert.ok(index.length > 20, "real KB pack loaded");
const routeLocal = (q) => { const m = matchKb(index, q, { platform: "win32" }); return m && m.doc.id; };
assert.equal(routeLocal("How do I fix a stuck Windows update?"), "diagnostics/update-stuck.md", "offline: stuck-update -> update-stuck.md");
assert.match(String(routeLocal("printer not printing")), /printer/, "offline printer route intact");
assert.match(String(routeLocal("audio not working there is no sound")), /audio-issues/, "offline audio route intact");
const bg = stemBigrams("How do I fix a stuck Windows update?");
assert.ok(bg.has("window update") && bg.has("stuck window"), "phrase-signal bigrams present");
for (const q of ["book me a flight to new york", "what is the weather tomorrow"]) {
  assert.equal(matchKb(index, q), null, `offline out-of-scope "${q}" abstains`);
}
const noMatch = localKbAnswer({ message: "book me a flight to new york", index });
assert.equal(noMatch.matched, false, "offline abstain is honest");
assert.doesNotMatch(noMatch.text, /From the offline knowledge base/, "an abstain never dresses up as an article");

console.log("KB phrase-routing (D1 LIVE path) passed — live scorer routes stuck-update -> " + UPDATE + " (audio demoted); web-twin routeIds match; desktop askAria relevance floor rejects the off-topic audio match and serves the correct update article; printer/audio/display stable; out-of-scope abstains; offline local-KB fallback intact.");
