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

assert.equal(n, 7, "7 KB-first test groups");
console.log(`kb-first-wiring test passed (${n} groups · confident hit skips Anthropic · low-conf/no-match/timeout/no-excerpt fall through · R11 scrub · inclusive threshold ${KB_CONFIDENCE_MIN}).`);
