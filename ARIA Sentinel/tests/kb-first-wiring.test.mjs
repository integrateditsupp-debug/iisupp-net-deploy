// RUN 31 — KB-first wiring: askAria hits aria-kb-query ($0 retrieval) BEFORE aria-chat (Anthropic). A confident
// KB match returns immediately and NEVER calls the LLM; a no-match / low-confidence / timeout falls through to
// the UNCHANGED aria-chat path. Proves Ahmad's rule "don't use Anthropic unless needed" + the R11 scrub.
import assert from "node:assert/strict";
import { askAria, KB_QUERY_ENDPOINT, KB_CONFIDENCE_MIN, CHAT_ENDPOINT } from "../src/shared/aria-brain-client.mjs";

let n = 0; const t = () => { n++; };

// A URL-routing mock: aria-kb-query returns `kb`; aria-chat returns the LLM `chatText`.
function makeFetch({ kb, chatText = "LLM (Anthropic) answer", kbThrow = false, chatThrow = false }) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (String(url).includes("aria-kb-query")) {
      if (kbThrow) throw new Error("kb timeout");
      return { ok: true, json: async () => kb };
    }
    if (chatThrow) throw new Error("chat offline");
    return { ok: true, json: async () => ({ text: chatText, sessionId: "chat-1" }) };
  };
  return { fetchImpl, calls };
}
const calledChat = (calls) => calls.some((c) => String(c).includes("aria-chat"));
const calledKb = (calls) => calls.some((c) => String(c) === KB_QUERY_ENDPOINT);

// 1 — confident KB match (confidence 27 ≥ 8) → returns kb-match, and aria-chat is NEVER called ($0).
{
  const kb = { match: true, confidence: 27, article: { slug: "fix-wifi", url: "https://iisupp.net/kb/fix-wifi", title: "Fix Wi-Fi", tier: "L1" }, content_excerpt: "Toggle Wi-Fi off/on, forget the network, rejoin." };
  const { fetchImpl, calls } = makeFetch({ kb });
  const r = await askAria("wifi keeps dropping", { fetchImpl });
  assert.equal(r.action, "kb-match", "confident KB match → kb-match action");
  assert.match(r.reply, /Toggle Wi-Fi/, "KB excerpt surfaced");
  assert.match(r.reply, /iisupp\.net\/kb\/fix-wifi/, "full-article link appended");
  assert.equal(r.offline, false);
  assert.equal(r.kb_match.confidence, 27);
  assert.equal(r.kb_match.slug, "fix-wifi");
  assert.equal(calledKb(calls), true, "KB queried first");
  assert.equal(calledChat(calls), false, "aria-chat (Anthropic) NEVER called on a confident KB hit");
}
t();

// 2 — low confidence (3 < 8) → falls through to aria-chat (LLM answer), kb-query was still tried.
{
  const kb = { match: true, confidence: 3, article: { slug: "x" }, content_excerpt: "weak partial" };
  const { fetchImpl, calls } = makeFetch({ kb });
  const r = await askAria("something obscure", { fetchImpl });
  assert.notEqual(r.action, "kb-match", "below threshold is not a kb-match");
  assert.match(r.reply, /Anthropic/, "fell through to the LLM");
  assert.equal(calledKb(calls), true);
  assert.equal(calledChat(calls), true, "aria-chat used when KB confidence < threshold");
}
t();

// 3 — KB no-match → falls through to aria-chat.
{
  const { fetchImpl, calls } = makeFetch({ kb: { match: false } });
  const r = await askAria("novel question", { fetchImpl });
  assert.notEqual(r.action, "kb-match");
  assert.match(r.reply, /Anthropic/);
  assert.equal(calledChat(calls), true);
}
t();

// 4 — KB query times out / errors → swallowed, falls through to aria-chat (never throws).
{
  const { fetchImpl, calls } = makeFetch({ kb: {}, kbThrow: true });
  const r = await askAria("anything", { fetchImpl });
  assert.match(r.reply, /Anthropic/, "KB timeout → LLM fallback");
  assert.equal(calledChat(calls), true);
}
t();

// 5 — KB match missing content_excerpt → not used (must have an excerpt), falls through.
{
  const kb = { match: true, confidence: 50, article: { slug: "y" } }; // no content_excerpt
  const { fetchImpl, calls } = makeFetch({ kb });
  const r = await askAria("x", { fetchImpl });
  assert.notEqual(r.action, "kb-match", "no excerpt → cannot return a KB answer");
  assert.equal(calledChat(calls), true);
}
t();

// 6 — 🔒 R11: a KB excerpt containing a path/private-folder is scrubbed before it reaches the UI.
{
  const kb = { match: true, confidence: 20, article: { url: "https://iisupp.net/kb/z" }, content_excerpt: "See C:\\Users\\bob\\Private pics and Vids\\x and C:\\Users\\bob\\logs" };
  const { fetchImpl } = makeFetch({ kb });
  const r = await askAria("q", { fetchImpl });
  assert.equal(r.action, "kb-match");
  assert.doesNotMatch(r.reply, /private\s+pics\s+and\s+vids/i, "R11 folder scrubbed");
  assert.doesNotMatch(r.reply, /C:\\Users\\bob/, "raw user path scrubbed");
}
t();

// 7 — threshold is exactly KB_CONFIDENCE_MIN inclusive.
{
  const kb = { match: true, confidence: KB_CONFIDENCE_MIN, article: {}, content_excerpt: "right at the threshold" };
  const r = await askAria("q", { fetchImpl: makeFetch({ kb }).fetchImpl });
  assert.equal(r.action, "kb-match", `confidence === ${KB_CONFIDENCE_MIN} is accepted (inclusive)`);
}
t();

// 8 — RUN-CU / CU4: multi-turn history + voice contract. buildChatRequest sends prior turns (last 12, R11-scrubbed,
//     user/assistant only) ahead of the prompt and `voice: true` ONLY when asked; askAria surfaces aria-chat's
//     speak / needs_input / listen / action{kind, recipeHint} as actionDetail while keeping the string `action`.
{
  const { buildChatRequest, normalizeHistory, HISTORY_MAX_TURNS } = await import("../src/shared/aria-brain-client.mjs");
  assert.equal(HISTORY_MAX_TURNS, 12);
  const big = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i}` }));
  const hist = normalizeHistory([...big, { role: "system", content: "ignored" }, { role: "user", content: "  " }]);
  assert.equal(hist.length, 12, "history capped at the last 12 turns"); assert.equal(hist[0].content, "turn 18");
  assert.deepEqual(normalizeHistory([{ role: "me", text: "C:\\Users\\bob\\Private pics and Vids\\x" }, { role: "aria", text: "ok" }]).map((m) => m.role), ["user", "assistant"], "renderer who→role mapped");
  assert.doesNotMatch(JSON.stringify(normalizeHistory([{ role: "user", content: "see C:\\Users\\bob\\Private pics and Vids\\x" }])), /private\s+pics|C:\\\\Users/i, "R11 scrub applies to history");
  const plain = JSON.parse(buildChatRequest("hello", { messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }).body);
  assert.deepEqual(plain.messages, [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "hello" }], "history precedes the new prompt");
  assert.equal("voice" in plain, false, "typed asks do not set voice");
  const voiced = JSON.parse(buildChatRequest("hello", { voice: true, platform: "darwin" }).body);
  assert.equal(voiced.voice, true); assert.equal(voiced.platform, "darwin"); assert.deepEqual(voiced.messages, [{ role: "user", content: "hello" }]);
  // the reply: voice fields pass through (scrubbed), action object → string action + actionDetail
  const fetchImpl = async (url) => {
    if (String(url).includes("aria-kb-query")) return { ok: true, json: async () => ({ match: false }) };
    return { ok: true, json: async () => ({ text: "I can restart the print spooler here.", speak: "I can restart the spooler. Say yes.", needs_input: true, listen: true, action: { kind: "sentinel-fix", recipeHint: "restart print spooler C:\\Users\\bob\\x" }, sessionId: "v1" }) };
  };
  const r = await askAria("printer stuck", { fetchImpl, voice: true });
  assert.equal(r.action, "sentinel-fix", "string action kept for every existing caller");
  assert.equal(r.speak, "I can restart the spooler. Say yes."); assert.equal(r.needs_input, true); assert.equal(r.listen, true);
  assert.equal(r.actionDetail.kind, "sentinel-fix"); assert.match(r.actionDetail.recipeHint, /^restart print spooler/); assert.doesNotMatch(r.actionDetail.recipeHint, /C:\\Users/, "recipeHint R11-scrubbed");
  assert.equal(r.session_id, "v1");
  // a plain (non-voice) reply carries NO voice fields — nothing invented
  const r2 = await askAria("printer stuck", { fetchImpl: makeFetch({ kb: { match: false } }).fetchImpl });
  assert.equal("speak" in r2, false); assert.equal("listen" in r2, false); assert.equal("actionDetail" in r2, false);
}
t();

assert.equal(n, 8, "8 KB-first test groups");
console.log(`kb-first-wiring test passed (${n} groups · confident hit skips Anthropic · low-conf/no-match/timeout/no-excerpt fall through · R11 scrub · inclusive threshold ${KB_CONFIDENCE_MIN} · CU4 history + voice contract).`);
