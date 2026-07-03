// D1 (2026-07-03) — KB retrieval must ABSTAIN, not return the nearest WRONG article. With external AI
// disabled at runtime there is no Anthropic fallback, so a wrong-but-confident answer would just be served.
// A query-anchored relevance floor (discounting generic platform words) makes "stuck Windows update" abstain
// while "printer not printing" still matches. Covers BOTH paths: the offline local KB and the live kb-match.
import assert from "node:assert/strict";
import { kbRelevance, KB_RELEVANCE_FLOOR, localKbAnswer } from "../src/shared/aria-local-kb.mjs";
import { askAria, KB_QUERY_ENDPOINT } from "../src/shared/aria-brain-client.mjs";

let n = 0; const t = () => { n++; };

// 1 — kbRelevance discriminates: the windows-update query is IRRELEVANT to an audio article (no meaningful
// overlap once the generic word "windows" is discounted), but "printer not printing" is fully relevant.
const AUDIO = "Audio Issues. Sound is missing, too quiet, or distorted. no sound, audio not working, restart the Windows Audio service, volume mixer, default output device";
assert.ok(kbRelevance("How do I fix a stuck Windows update?", AUDIO) < KB_RELEVANCE_FLOOR, "windows-update query is NOT relevant to the audio article");
assert.ok(kbRelevance("printer not printing", "Printer not printing. restart the print spooler, printer offline") >= KB_RELEVANCE_FLOOR, "printer query IS relevant to the printer article");
// A real windows-update article DOES clear the floor for the same query.
assert.ok(kbRelevance("How do I fix a stuck Windows update?", "Update Stuck. Windows Update is stuck downloading or installing; reset the update components") >= KB_RELEVANCE_FLOOR, "windows-update query matches the real update-stuck article");
t();

// 2 — OFFLINE path: with a bundled-style index holding BOTH an audio doc and an update-stuck doc, the
// windows-update query must return update-stuck (NOT audio); a nonsense query must abstain.
const INDEX = [
  { id: "diagnostics/audio-issues.md", platform: "", title: "Audio Issues", text: "sound missing quiet distorted no sound audio not working windows audio service volume mixer" },
  { id: "diagnostics/update-stuck.md", platform: "", title: "Update Stuck", text: "windows update stuck downloading installing reset update components clear softwaredistribution" },
  { id: "diagnostics/printer-issues.md", platform: "", title: "Printer Issues", text: "printer not printing print spooler offline queue stuck" }
];
const upd = localKbAnswer({ message: "How do I fix a stuck Windows update?", platform: "win32", index: INDEX });
assert.equal(upd.matched, true, "windows-update query finds a real match offline");
assert.equal(upd.id, "diagnostics/update-stuck.md", "windows-update query returns update-stuck, NOT the audio article");
assert.doesNotMatch(upd.text, /Audio Issues/, "the audio article is never rendered for a windows-update query");
const none = localKbAnswer({ message: "how do I train my parrot to sing", platform: "win32", index: INDEX });
assert.equal(none.matched, false, "an unrelated query abstains instead of returning the nearest doc");
t();

// 3 — OFFLINE path, the exact D1 shape: an index WITHOUT any windows-update doc must ABSTAIN for the
// windows-update query rather than returning the nearest (audio) article.
const NO_UPDATE_DOC = [INDEX[0], INDEX[2]];
const abstain = localKbAnswer({ message: "How do I fix a stuck Windows update?", platform: "win32", index: NO_UPDATE_DOC });
assert.equal(abstain.matched, false, "no relevant doc → abstain");
assert.doesNotMatch(abstain.text, /Audio Issues/, "must NOT surface the audio article");
t();

// 4 — LIVE kb-match path: a confident-but-irrelevant server match (audio article, confidence 20) must be
// REJECTED by the relevance floor and fall through (→ offline local-KB), never surfaced as the answer.
const audioServer = {
  match: true, confidence: 20, content_excerpt: AUDIO,
  article: { slug: "l1-windows-005-audio", title: "Windows: no sound", tier: "l1" }
};
const fetchAudio = async (url) => {
  if (url === KB_QUERY_ENDPOINT) return { ok: true, json: async () => audioServer };
  return { ok: false, status: 503, json: async () => ({}) }; // aria-chat disabled → offline
};
const rWrong = await askAria("How do I fix a stuck Windows update?", { fetchImpl: fetchAudio });
assert.notEqual(rWrong.action, "kb-match", "an irrelevant live KB match is NOT accepted");
assert.equal(rWrong.offline, true, "it falls through to the offline local-KB path");
assert.doesNotMatch(rWrong.reply || "", /no sound/i, "the audio article text is never returned");
t();

// 5 — LIVE kb-match path: a genuinely relevant server match (printer article) IS accepted.
const printerServer = {
  match: true, confidence: 20, content_excerpt: "Printer not printing. Restart the print spooler service.",
  article: { slug: "l1-printer-001", title: "Printer not printing", tier: "l1" }
};
const fetchPrinter = async (url) => {
  if (url === KB_QUERY_ENDPOINT) return { ok: true, json: async () => printerServer };
  return { ok: false, status: 503, json: async () => ({}) };
};
const rRight = await askAria("printer not printing anything", { fetchImpl: fetchPrinter });
assert.equal(rRight.action, "kb-match", "a relevant live KB match is accepted");
assert.match(rRight.reply, /spooler/i, "the printer article is returned");
t();

assert.equal(n, 5, "5 D1 abstain-floor test groups");
console.log(`kb-abstain-floor test passed (${n} groups · relevance floor · offline abstain · live kb-match rejected when irrelevant · printer still matches).`);
