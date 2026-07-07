// ARIA topics fallback (2026-07-07) — the SAME conversational brain that powers iisupp.net/aria
// (aria-brain.js v2, TOPICS engine) wired into Sentinel's OFFLINE chat tier.
//
// Position in the locked chat chain (ADDITIVE — nothing above it changes):
//   1. live aria-brain (KB-first -> Anthropic)      [online, unchanged]
//   2. bundled cross-platform KB (localKbAnswer)    [offline, unchanged]
//   3. THIS: shared TOPICS brain — guided, multi-turn, $0   [offline, new — only when 2 has no match]
//
// Master copy of the engine: /aria-brain.js in the site repo. The local ./aria-brain.cjs is a
// byte-identical sync copy (tools/sync-aria-brain.mjs). Engine is UMD + Node-safe (v2).
//
// Honesty (Rule 14): the brain GUIDES the user through steps — it does not execute fixes. Its own
// HONEST_TAIL says exactly that. Sentinel's separate "Resolve it for me" chip remains the supervised
// execution path.

import { createRequire } from "module";

const require = createRequire(import.meta.url);

let AriaBrain = null;
try {
  AriaBrain = require("./aria-brain.cjs");
} catch {
  AriaBrain = null; // copy missing -> tier disables itself; callers keep their existing no-match copy
}

const SESSION_IDLE_MS = 30 * 60 * 1000; // a fresh problem after 30 quiet minutes = a fresh session
let session = null;
let lastAt = 0;
let lastOptions = [];

function freshSessionIfIdle() {
  const now = Date.now();
  if (!session || now - lastAt > SESSION_IDLE_MS) session = AriaBrain.newSession();
  lastAt = now;
}

// Bare "2" while a clarifier is open means option #2 — translate before the engine sees it.
function expandNumericChoice(message) {
  const m = String(message || "").trim();
  if (/^[1-9]$/.test(m) && lastOptions.length) {
    const idx = Number(m) - 1;
    if (idx >= 0 && idx < lastOptions.length) return lastOptions[idx];
  }
  return m;
}

function toMarkdown(r) {
  const parts = [];
  if (r.empathy) parts.push(`_${r.empathy}_`);
  if (r.say) parts.push(r.say);
  if (r.ask) {
    const opts = (r.options || []).map((o, i) => `${i + 1}. ${o}`).join("\n");
    parts.push(`**${r.ask}**${opts ? `\n\n${opts}\n\nReply with the number or your own words.` : ""}`);
  } else if (r.options && r.options.length) {
    parts.push(r.options.map((o, i) => `${i + 1}. ${o}`).join("\n"));
  }
  if (r.steps && r.steps.length) parts.push(r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"));
  if (r.escalate) parts.push(`_If that doesn't resolve it: ${r.escalate}_`);
  if (r.also) parts.push(`_${r.also}_`);
  if (r.tail) parts.push(`_${r.tail}_`);
  return parts.join("\n\n");
}

/**
 * Try to take the offline turn with the shared TOPICS brain.
 * Returns { text, stage, topic, engine: "aria-topics" } or null when the brain has no confident route
 * (callers then keep their existing offline no-match message — never a regression).
 */
export function topicsAnswer(message) {
  if (!AriaBrain) return null;
  try {
    freshSessionIfIdle();
    const text = expandNumericChoice(message);
    const midFlow = Boolean(
      session.topic && (session.stage === "awaiting" || session.stage === "checking" || session.stage === "answered")
    );
    const isGreetBye =
      /^(hi|hello|hey|thanks|thank you|bye|good (morning|afternoon|evening))\b/i.test(text) &&
      text.split(/\s+/).length <= 4;
    if (!midFlow && !isGreetBye) {
      const cls = AriaBrain.classify(text.toLowerCase(), session);
      if (!cls || cls.score < 4) return null;
    }
    const r = AriaBrain.handleTurn(session, text);
    if (!r || (!r.say && !r.ask && !r.steps)) return null;
    lastOptions = Array.isArray(r.options) ? r.options.slice() : [];
    if (r.stage === "closed") session = AriaBrain.newSession();
    return { text: toMarkdown(r), stage: r.stage || "", topic: r.topic || null, engine: "aria-topics" };
  } catch {
    return null; // the offline tier must never break chat
  }
}

// test hook — lets the suite reset conversation state between cases
export function _resetTopicsSession() {
  session = null;
  lastAt = 0;
  lastOptions = [];
}
