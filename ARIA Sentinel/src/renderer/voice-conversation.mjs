// RUN-CU / CU4 (2026-10-08) — the multi-turn voice conversation, shared by the globe companion (overlay.js
// Voice ASK) and the ARIA tab (renderer.js 🎤). Browser-safe: only relative imports (CSP), no node:/bare.
//
// What it does, honestly:
//   · the mic is ON only while listening (createLocalStt → on-device Vosk) and is RELEASED on every stop;
//     no audio ever leaves the machine, there is no cloud recognizer, and no mic → the loop simply does not start
//   · each heard utterance is shown as a transcript row BEFORE it is sent (you can see what was heard — Rule 14)
//   · the reply is narrated; when the brain says listen:true the mic re-arms for the next turn; "that's all" /
//     "stop" / "thank you, bye" end the conversation; a tap on the globe/mic while listening ends the turn,
//     while speaking stops the narration
//   · a vetted fix the brain offers is NEVER run from here: "yes" routes through the approval policy
//     (supervisedFix → approval record → in-app approval), and the real outcome is narrated as it happened.
// The turn machine itself is pure (../shared/voice-turns.mjs) and unit-tested; this file is the glue.
import { createLocalStt } from "./local-stt.mjs";
import { createVoiceState, transition, trimHistory } from "../shared/voice-turns.mjs";

const UTTERANCE_SETTLE_MS = 1100; // after a final STT result, wait briefly for a continuation before sending

/** Default on-device narrator (speechSynthesis) with an onEnd callback; hosts may inject their own. */
export function defaultNarrate(text, { onEnd } = {}) {
  const done = () => { try { if (typeof onEnd === "function") onEnd(); } catch { /* host callback must not break the loop */ } };
  if (typeof speechSynthesis === "undefined" || !text || !String(text).trim()) { done(); return false; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).trim());
    const voices = speechSynthesis.getVoices() || [];
    const v = voices.find((x) => /aria|jenny/i.test(x.name)) || voices.find((x) => /zira/i.test(x.name)) || voices.find((x) => /^en[-_]?US/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang)) || null;
    if (v) u.voice = v;
    u.lang = (v && v.lang) || "en-US";
    u.rate = 0.95; u.pitch = 1.0;
    u.addEventListener("end", done);
    u.addEventListener("error", done);
    speechSynthesis.speak(u);
    return true;
  } catch { done(); return false; }
}

export function createVoiceConversation(deps = {}) {
  const stt = deps.stt || createLocalStt;
  const narrate = deps.narrate || defaultNarrate;
  const cancelNarration = deps.cancelNarration || (() => { try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch { /* ignore */ } });
  const setGlobe = deps.setGlobeState || (() => {});
  const onTranscript = deps.onTranscript || (() => {});
  const onStatus = deps.onStatus || (() => {});
  const chat = deps.chat;                 // async (text, { history, voice:true }) → reply
  const supervisedFix = deps.supervisedFix; // async ({ recipeId, mode, source })
  const voiceApprove = deps.voiceApprove;   // async (recipeId) → approve the pending ask
  const voskModelUrl = deps.voskModelUrl;   // async () → file:// url | null
  const platform = deps.platform || "";

  let s = createVoiceState();
  let engine = null;        // the live STT controller (mic ON) or null (mic OFF)
  let heard = "";
  let settleTimer = null;
  let speaking = false;
  let active = false;

  function status(st) { onStatus(st); setGlobe(st === "listening" ? "listening" : st === "thinking" ? "diagnosing" : st === "speaking" ? "speaking" : "idle"); }
  function releaseMic() { if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; } if (engine) { try { engine.stop(); } catch { /* already released */ } engine = null; } }

  async function startListening() {
    releaseMic();
    heard = "";
    try {
      const modelUrl = await voskModelUrl();
      if (!modelUrl) { apply({ type: "error", reason: "no-local-model" }); return; }
      engine = await stt({ modelUrl, onText: (text) => {
        if (!text) return;
        heard = (heard ? heard + " " : "") + text.trim();
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => { settleTimer = null; endTurn(); }, UTTERANCE_SETTLE_MS);
      } });
      status("listening");
    } catch { apply({ type: "error", reason: "mic-unavailable" }); }
  }
  function endTurn() {
    const text = heard.trim(); heard = "";
    releaseMic();
    apply({ type: "transcript", text });
  }

  async function runEffects(effects) {
    for (const e of effects) {
      if (e.type === "listen") { await startListening(); }
      else if (e.type === "transcript-row") { onTranscript({ who: e.who, text: e.text }); }
      else if (e.type === "ask") {
        status("thinking");
        let reply = null;
        try { reply = await chat(e.text, { history: trimHistory(e.history.slice(0, -1)), voice: true }); } catch { reply = null; }
        if (!active) return;
        apply({ type: "reply", text: reply ? (reply.text || reply.reply || "") : "", speak: reply ? reply.speak : "", listen: reply ? reply.listen : false, action: reply ? (reply.voiceAction || reply.action) : null, fixOffer: reply ? reply.fixOffer : null });
      }
      else if (e.type === "speak") {
        status("speaking"); speaking = true;
        narrate(e.text, { onEnd: () => { speaking = false; if (active) apply({ type: "spoken" }); } });
      }
      else if (e.type === "approve-fix") { await approveAndRun(e.recipeId, e.title); }
      else if (e.type === "deny-fix") { onTranscript({ who: "status", text: "Skipped — nothing was changed." }); }
      else if (e.type === "end") { active = false; releaseMic(); if (speaking) { cancelNarration(); speaking = false; } status("idle"); onTranscript({ who: "status", text: e.reason === "end-phrase" ? "Conversation ended." : e.reason && e.reason.startsWith("error") ? "Voice unavailable — typing still works." : "" }); }
    }
  }
  function apply(event) {
    const r = transition(s, event);
    s = r.next;
    runEffects(r.effects).catch(() => { active = false; releaseMic(); status("idle"); });
  }

  // "yes" → the approval policy decides (supervisedFix); an approval-requested verdict is then approved in-app by
  // the person's spoken yes (voiceApprove). Whatever happened is narrated as it happened — never "fixed" unless it ran.
  async function approveAndRun(recipeId, title) {
    status("thinking");
    onTranscript({ who: "status", text: `Asking the safety gate to run: ${title || recipeId}` });
    let result = null;
    try { result = await supervisedFix({ recipeId, mode: "confirmed", source: "voice", risk: "medium" }); } catch { result = null; }
    if (result && result.verdict === "approval-requested" && typeof voiceApprove === "function") {
      try { const a = await voiceApprove(recipeId); result = a && a.result ? a.result : (a && a.ok === false ? { ok: false, copy: `I couldn't approve that: ${a.reason || "no pending approval"}.` } : result); } catch { /* keep the first verdict */ }
    }
    const message = describeFixResult(result, title);
    apply({ type: "fix-result", ok: Boolean(result && result.ok), message });
  }

  const api = {
    start: async () => { if (active) return { ok: true, already: true }; active = true; s = createVoiceState(); apply({ type: "start" }); return { ok: true }; },
    stop: () => { if (!active) return; apply({ type: "stop" }); },
    isActive: () => active,
    isListening: () => active && s.state === "listening",
    isSpeaking: () => active && speaking,
    state: () => s.state,
    history: () => s.history.slice(),
    /** A tap on the globe/mic: listening → end the turn now; speaking → stop talking and listen; idle → start. */
    globeTap: async () => {
      if (!active) return api.start();
      if (s.state === "listening") { endTurn(); return; }
      if (s.state === "speaking") { cancelNarration(); speaking = false; apply({ type: "spoken" }); return; }
    }
  };
  return api;
}

/** Plain words for what the gated pipeline actually did (Rule 14). */
export function describeFixResult(r, title) {
  const t = title || "that";
  if (!r) return `I couldn't start ${t} just now. Nothing was changed.`;
  if (r.copy && (r.verdict === "notify-only" || r.verdict === "blocked" || r.verdict === "deferred" || r.verdict === "policy")) return r.copy;
  if (r.ok === false) return r.reason ? `I couldn't run ${t}: ${String(r.reason).replace(/[-_]/g, " ")}. Nothing was changed.` : `I couldn't run ${t}. Nothing was changed.`;
  if (r.countdown) return `Running ${t} in ${r.seconds || 10} seconds — say stop or press control alt K to cancel.`;
  if (r.verdict === "approval-requested") return `${t} is waiting for approval — I'll run it as soon as someone says yes.`;
  if (r.policy && r.policy.dryRun === false) return `${t} is running now. I'll tell you when it's done.`;
  if (r.dryRun === false && r.ok) return `${t} is done.`;
  return `I previewed ${t} safely — nothing was changed. Turn on live fixes in Settings to apply it.`;
}
