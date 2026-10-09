// RUN-CU / CU4 (2026-10-08) — the voice conversation turn machine. PURE: no DOM, no mic, no network, so the
// whole loop is unit-tested (tests/voice-turns.test.mjs). src/renderer/voice-conversation.mjs drives the real
// mic (createLocalStt) + narration (speechSynthesis) off these transitions; main.mjs reuses the fix
// announcement builder so chat + voice say the same honest words.
//
// States:  idle → listening → thinking → speaking → listening … → idle (end phrase / stop / error)
// Rules (Rule 14): a transcript is shown before it is sent (the person can see what was heard); an empty
// transcript is dropped, never fabricated; "yes" only approves a fix the brain actually offered.
export const VOICE_STATES = Object.freeze(["idle", "listening", "thinking", "speaking"]);
export const HISTORY_MAX = 12;
export const END_PHRASES = Object.freeze(["that's all", "thats all", "that is all", "stop", "stop listening", "thank you, bye", "thank you bye", "thanks, bye", "thanks bye", "bye", "goodbye", "never mind", "cancel", "that's it", "thats it", "i'm done", "im done", "done"]);
export const YES_PHRASES = Object.freeze(["yes", "yes please", "yeah", "yep", "go ahead", "do it", "please do", "okay do it", "ok do it", "sure", "approve", "approved", "fix it", "go for it", "yes go ahead"]);
export const NO_PHRASES = Object.freeze(["no", "nope", "don't", "do not", "not now", "hold on", "wait", "deny", "denied", "skip"]);

const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** Is the utterance a conversation-ending phrase? Whole-utterance match (not a substring of a longer sentence). */
export function isEndPhrase(text) {
  const t = norm(text).replace(/^(aria|ok|okay|alright|please)\s+/g, "").trim();
  return END_PHRASES.some((p) => norm(p) === t);
}
// A yes/no must be the WHOLE utterance (plus a short courtesy tail) — "yes but not that one" is not a yes,
// "no idea what happened" is not a no. Anything longer is treated as an ordinary sentence.
export function isYes(text) { const t = norm(text); return YES_PHRASES.some((p) => norm(p) === t) || /^(yes|yeah|yep|yup|sure|okay|ok)(\s+(please|do it|go ahead|go for it|thanks|thank you|fix it|approve))?$/.test(t); }
export function isNo(text) { const t = norm(text); return NO_PHRASES.some((p) => norm(p) === t) || /^(no|nope)(\s+(thanks|thank you|not now|skip|don't|do not|leave it|please))?$/.test(t); }

/** Map a chat reply's action (string or {kind, recipeHint}) → 'guide' | 'sentinel-fix' | 'escalate' | 'none'. */
export function mapAction(action) {
  if (action && typeof action === "object") {
    const k = action.kind;
    if (k === "sentinel-fix" && action.recipeHint) return "sentinel-fix";
    if (k === "escalate") return "escalate";
    if (k === "guide" || k === "sentinel-fix") return "guide"; // a fix with no hint is just guidance
    return "none";
  }
  const a = String(action || "");
  if (a === "escalate") return "escalate";
  if (a === "kb-match" || a === "resolved" || a === "guide") return "guide";
  return "none";
}

/** Spoken version of a text reply when the brain sent none: first two sentences, no markdown/URLs, ≤ 400 chars. */
export function deriveSpeak(text) {
  const plain = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`>#|]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  const sentences = plain.match(/[^.!?]+[.!?]+/g) || [plain];
  return sentences.slice(0, 2).map((s) => s.trim()).join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
}

/** Keep the last HISTORY_MAX turns ({role, content}); drops empties; never mutates the input. */
export function trimHistory(history, max = HISTORY_MAX) {
  const list = (Array.isArray(history) ? history : []).filter((t) => t && (t.role === "user" || t.role === "assistant") && String(t.content || "").trim());
  return list.slice(-Math.max(1, Number(max) || HISTORY_MAX)).map((t) => ({ role: t.role, content: String(t.content).trim().slice(0, 2000) }));
}

/** The honest spoken offer for a vetted fix. Platform-aware: never says "fix" where no engine runs. */
export function buildVoiceFixAnnouncement({ title, platform, color } = {}) {
  const t = String(title || "that").replace(/[^\w .,:;'()\-\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const p = String(platform || "").toLowerCase();
  if (p === "win32" || p === "windows") return `I can fix that here — ${t}. Say yes to approve, or no to skip.`;
  if (p === "darwin" || p === "macos") return color === "green" ? `I can run a user-level fix here — ${t}. Say yes to approve, or no to skip.` : `I can guide you through ${t} on this Mac — I don't run that kind of fix here myself.`;
  return `I can walk you through ${t} — no agent runs fixes on this device, so I'll guide you step by step.`;
}

/** Fresh machine state. */
export function createVoiceState() {
  return { state: "idle", history: [], pendingFix: null, turns: 0, lastTranscript: "", endedReason: "" };
}

/**
 * One transition. Pure: returns { next, effects[] } and never mutates `s`.
 *   event ∈ 'start' | 'stop' | 'transcript' {text} | 'reply' {text, speak, listen, action, fixOffer} |
 *           'spoken' | 'error' {reason} | 'fix-result' {ok, message}
 * effects ∈ { type: 'listen' } · { type: 'ask', text, history } · { type: 'speak', text } · { type: 'end', reason } ·
 *           { type: 'transcript-row', who, text } · { type: 'approve-fix', recipeId, title } · { type: 'deny-fix', recipeId }
 */
export function transition(s, event = {}) {
  const st = s || createVoiceState();
  const type = event.type;
  const effects = [];
  const next = { ...st, history: st.history.slice() };

  if (type === "start") {
    next.state = "listening"; next.endedReason = "";
    effects.push({ type: "listen" });
    return { next, effects };
  }
  if (type === "stop" || type === "error") {
    next.state = "idle"; next.pendingFix = null; next.endedReason = type === "error" ? `error:${event.reason || "unknown"}` : "stopped";
    effects.push({ type: "end", reason: next.endedReason });
    return { next, effects };
  }
  if (type === "transcript") {
    const text = String(event.text || "").trim();
    if (st.state !== "listening") return { next, effects }; // ignore stray results
    if (!text) { effects.push({ type: "listen" }); return { next, effects }; } // nothing heard → keep listening, never invent
    next.lastTranscript = text;
    effects.push({ type: "transcript-row", who: "me", text });
    if (isEndPhrase(text)) { next.state = "idle"; next.pendingFix = null; next.endedReason = "end-phrase"; effects.push({ type: "end", reason: "end-phrase" }); return { next, effects }; }
    // A pending fix offer: yes → in-app approval; no → skip and keep talking.
    if (st.pendingFix && isYes(text)) {
      next.state = "thinking"; next.pendingFix = null;
      effects.push({ type: "approve-fix", recipeId: st.pendingFix.recipeId, title: st.pendingFix.title });
      return { next, effects };
    }
    if (st.pendingFix && isNo(text)) {
      next.state = "speaking"; next.pendingFix = null;
      effects.push({ type: "deny-fix", recipeId: st.pendingFix.recipeId });
      effects.push({ type: "speak", text: "Okay — I won't touch it. What else can I help with?" });
      return { next, effects };
    }
    next.state = "thinking"; next.turns = st.turns + 1;
    next.history = trimHistory([...st.history, { role: "user", content: text }]);
    effects.push({ type: "ask", text, history: next.history });
    return { next, effects };
  }
  if (type === "reply") {
    const text = String(event.text || "").trim();
    const speak = String(event.speak || "").trim() || deriveSpeak(text);
    if (!text && !speak) { next.state = "idle"; next.endedReason = "empty-reply"; effects.push({ type: "end", reason: "empty-reply" }); return { next, effects }; }
    next.history = trimHistory([...st.history, { role: "assistant", content: text || speak }]);
    const action = mapAction(event.action);
    next.pendingFix = event.fixOffer && event.fixOffer.recipeId ? { recipeId: String(event.fixOffer.recipeId), title: String(event.fixOffer.title || "") } : null;
    next.listenAfter = next.pendingFix ? true : event.listen !== false; // a fix offer always waits for yes/no
    next.state = "speaking";
    effects.push({ type: "transcript-row", who: "aria", text: text || speak });
    effects.push({ type: "speak", text: speak });
    if (action === "escalate") next.escalate = true;
    return { next, effects };
  }
  if (type === "fix-result") {
    next.state = "speaking";
    const msg = String(event.message || (event.ok ? "Done." : "That did not complete; nothing further was changed."));
    effects.push({ type: "transcript-row", who: "aria", text: msg });
    effects.push({ type: "speak", text: msg });
    next.listenAfter = true;
    return { next, effects };
  }
  if (type === "spoken") {
    if (st.state !== "speaking") return { next, effects };
    if (st.listenAfter === false) { next.state = "idle"; next.endedReason = "reply-complete"; effects.push({ type: "end", reason: "reply-complete" }); return { next, effects }; }
    next.state = "listening";
    effects.push({ type: "listen" });
    return { next, effects };
  }
  return { next, effects };
}
