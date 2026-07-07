// App-runbook routing regression (2026-07-07) — pins the 10 new high-frequency business-app GUIDANCE runbooks
// (SMB / professional-services / finance) across the SAME live layers the D1 suite pins, so the test reflects
// what the desktop actually runs when ARIA Chat answers:
//   1. the live server scorer  — netlify/functions/aria-kb-query.mjs `score` + `ROUTING` over the REAL shipped
//      chunks (assets/aria-kb-chunks.json). This is the path desktop askAria() hits first ($0, no LLM).
//   2. the web /aria twin      — assets/aria-kb-retrieval.mjs `routeIds` (same routing, mirrored).
//   3. the desktop layers      — isRelevantKbMatch (D1 relevance floor) + askAria (KB-first with mock fetch).
// Contract: every new natural query routes CONFIDENTLY to ITS new article and NOT to a pre-existing off-topic
// neighbour; the new articles actually ship in the KB index; and existing routes + honest abstain are unchanged
// (additive-only — Rule 15). Adding an app runbook is gated by this test.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { score } from "../../netlify/functions/aria-kb-query.mjs";
import { routeIds } from "../../assets/aria-kb-retrieval.mjs";
import { askAria, isRelevantKbMatch } from "../src/shared/aria-brain-client.mjs";

const root = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(root, "..");
const chunks = JSON.parse(fs.readFileSync(path.join(repoRoot, "assets", "aria-kb-chunks.json"), "utf8")).chunks || [];
assert.ok(chunks.length > 200, "real web KB (aria-kb-chunks.json) loaded");

// Full slugs of the 10 new runbooks (all under knowledge-base/top50-gaps/).
const SLUG = {
  outlook6: "l1-outlook-006-profile-ost-rebuild",
  outlook7: "l1-outlook-007-search-not-returning-results",
  office2:  "l1-office-002-reenable-disabled-addin",
  pdf1:     "l1-pdf-001-wont-open-set-default",
  zoom3:    "l1-zoom-003-camera-mic-not-working-meeting",
  teams5:   "l1-teams-005-screen-share-not-working",
  teams4:   "l1-teams-004-cant-join-meeting",
  browser4: "l1-browser-004-cant-download-files",
  excel1:   "l1-excel-001-cannot-update-links",
  git1:     "l1-git-001-authentication-failed",
};

// Mirror the aria-kb-query handler ranking exactly: score → keep>0 → sort desc → confidence floor 8.
function liveTop(q) {
  const scored = chunks.map((c) => ({ slug: c.slug, s: score(q, c) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const top = scored[0] || null;
  return { slug: top && top.slug, score: top ? top.s : 0, confident: !!top && top.s >= 8 };
}
const shipped = (slug) => chunks.some((c) => c.slug === slug);

// ── 1 — every new runbook actually ships in the KB index the scorer ranks. ──
for (const slug of Object.values(SLUG)) assert.ok(shipped(slug), `new runbook ships in aria-kb-chunks.json: ${slug}`);

// ── 2 — LIVE SERVER SCORER: each natural query routes to ITS article, clears the floor, and is NOT the
//        pre-existing off-topic neighbour it could otherwise have leaked into. ──
// [query, expected-article-id-prefix, [off-topic prefixes it must NOT be]]
const CASES = [
  ["outlook will not start, cannot open the outlook window, I need to rebuild my profile", "l1-outlook-006", ["l1-outlook-001"]],
  ["outlook search is not working and returns no results, how do I rebuild the search index", "l1-outlook-007", ["l1-outlook-001"]],
  ["excel disabled my add-in, how do I re-enable a disabled COM add-in", "l1-office-002", ["l1-m365-002"]],
  ["pdf opens in edge instead of acrobat, how do I set adobe reader as the default pdf app", "l1-pdf-001", ["l1-browser-001"]],
  ["my pdf will not open", "l1-pdf-001", []],
  ["zoom camera not working, no one can see me in the meeting", "l1-zoom-003", ["l1-webcam-001"]],
  ["zoom no audio, I cannot hear anyone in the meeting", "l1-zoom-003", []],
  ["teams screen share not working, I cannot present my screen", "l1-teams-005", ["l1-teams-001"]],
  ["I cannot join my teams meeting, the meeting link will not connect", "l1-teams-004", ["l1-teams-002"]],
  ["chrome will not download files, every download is blocked", "l1-browser-004", []],
  ["excel cannot update some of the links to other workbooks", "l1-excel-001", []],
  ["git push authentication failed, remote invalid username or password", "l1-git-001", []],
];
for (const [q, want, mustNot] of CASES) {
  const t = liveTop(q);
  assert.equal(String(t.slug || "").startsWith(want), true, `live scorer: "${q}" -> ${want} (got ${t.slug})`);
  assert.ok(t.confident, `"${q}" clears the confidence floor (a real, correct answer)`);
  for (const bad of mustNot) assert.ok(!String(t.slug || "").startsWith(bad), `"${q}" must NOT route to ${bad}`);
}

// ── 3 — WEB /aria TWIN routeIds mirrors the same routing (and does not mis-route the PDF-default ask). ──
assert.ok(routeIds("outlook will not start rebuild profile ost").includes("l1-outlook-006"), "twin: outlook profile/OST");
assert.ok(routeIds("outlook search returns no results rebuild the search index").includes("l1-outlook-007"), "twin: outlook search");
assert.ok(routeIds("excel disabled my add-in re-enable a disabled com add-in").includes("l1-office-002"), "twin: disabled add-in");
assert.ok(routeIds("pdf opens in edge set adobe as default").includes("l1-pdf-001"), "twin: pdf default");
assert.ok(!routeIds("pdf opens in edge set adobe as default").includes("l1-browser-001"), "twin: pdf-default does NOT mis-route to the browser article");
assert.ok(routeIds("zoom camera not working in meeting").includes("l1-zoom-003"), "twin: zoom AV");
assert.ok(routeIds("teams screen share not working").includes("l1-teams-005"), "twin: teams screen share");
assert.ok(routeIds("I cannot join my teams meeting it will not connect").includes("l1-teams-004"), "twin: teams join");
assert.ok(routeIds("chrome will not download files every download is blocked").includes("l1-browser-004"), "twin: browser downloads");
assert.ok(routeIds("excel cannot update the links to other workbooks").includes("l1-excel-001"), "twin: excel links");
assert.ok(routeIds("git authentication failed invalid username or password").includes("l1-git-001"), "twin: git auth");

// ── 4 — DESKTOP relevance floor (the layer a rebuild verifies): on-topic accepted, off-topic rejected. ──
assert.equal(isRelevantKbMatch("outlook will not start rebuild profile ost", { slug: SLUG.outlook6, title: "" }), true, "outlook profile ask <-> its article is on-topic");
assert.equal(isRelevantKbMatch("my pdf will not open set acrobat as default", { slug: SLUG.pdf1, title: "" }), true, "pdf-default ask <-> its article is on-topic");
assert.equal(isRelevantKbMatch("git push authentication failed", { slug: SLUG.git1, title: "" }), true, "git-auth ask <-> its article is on-topic");
assert.equal(isRelevantKbMatch("git push authentication failed", { slug: "l1-printer-001-not-printing", title: "" }), false, "an off-topic printer article is judged OFF-topic for a git ask");
assert.equal(isRelevantKbMatch("my pdf will not open", { slug: "l1-windows-005-audio-no-sound", title: "no sound" }), false, "the audio article is OFF-topic for a pdf ask");

// ── 5 — askAria (the SAME function the desktop chat calls) with a mocked aria-kb-query response. ──
const makeFetch = (kb, chatText = "Anthropic fallback answer") => async (url) =>
  String(url).includes("aria-kb-query")
    ? { ok: true, json: async () => kb }
    : { ok: true, json: async () => ({ text: chatText, sessionId: "s1" }) };
{
  // a confident, on-topic PDF-default match IS served as a $0 KB answer.
  const right = { match: true, confidence: 30, article: { slug: SLUG.pdf1, title: "", tier: "L1", url: "https://iisupp.net/aria?article=" + SLUG.pdf1 }, content_excerpt: "Set the default PDF app in Windows Settings > Apps > Default apps, then reopen the file." };
  const r = await askAria("my pdf will not open, set acrobat as the default", { fetchImpl: makeFetch(right) });
  assert.equal(r.action, "kb-match", "confident on-topic PDF runbook is served as a KB answer");
  assert.equal(r.kb_match.slug, SLUG.pdf1);
}
{
  // a confident BUT off-topic match (audio article for a git ask) is REJECTED by the relevance floor, not served.
  const wrong = { match: true, confidence: 30, article: { slug: "l1-windows-005-audio-no-sound", title: "Windows: no sound at all from the computer", tier: "L1", url: "https://iisupp.net/aria?article=l1-windows-005" }, content_excerpt: "No sound from the computer..." };
  const r = await askAria("git push authentication failed", { fetchImpl: makeFetch(wrong) });
  assert.notEqual(r.action, "kb-match", "a confident-but-off-topic audio match is NOT served for a git ask");
}

// ── 6 — REGRESSION: existing routes unchanged + honest abstain intact (additive-only). ──
assert.equal(liveTop("how do I fix a stuck Windows update?").slug, "l1-windows-007-update-stuck-reboot-loop", "D1: stuck-update route intact");
assert.equal(String(liveTop("audio not working there is no sound").slug || "").startsWith("l1-windows-005"), true, "audio route intact");
assert.equal(String(liveTop("printer not printing").slug || "").startsWith("l1-printer-001"), true, "printer route intact");
assert.ok(routeIds("audio not working no sound").includes("l1-windows-005"), "twin audio route intact");
for (const q of ["book me a flight to new york", "what is the weather tomorrow"]) {
  assert.equal(liveTop(q).confident, false, `out-of-scope "${q}" stays below the floor (abstain)`);
}

console.log("App-runbook routing passed — 10 new business-app GUIDANCE runbooks (Outlook profile/OST, Outlook search, disabled Office add-in, PDF default/open, Zoom AV, Teams screen-share, Teams join, browser downloads, Excel links, Git auth) route confidently on the live scorer + web /aria twin, pass the desktop relevance floor, are served by askAria, and leave existing routes + honest abstain unchanged.");
