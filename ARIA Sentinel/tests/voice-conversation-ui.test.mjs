// RUN-CU / CU4 — voice conversation wiring (static): the shared renderer module (mic ON only while listening,
// released on stop; narration with onEnd; auto re-arm on listen:true; transcript rows for both sides), the ARIA
// tab 🎤 + "Voice conversation" toggle (mic hidden without the local model), the companion's multi-turn Voice ASK
// (original one-shot kept), and main's chat() passing history/voice/platform + the gated sentinel-fix offer.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createVoiceConversation, describeFixResult } from "../src/renderer/voice-conversation.mjs";

let n = 0; const t = () => { n++; };
const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const vc = rd("src", "renderer", "voice-conversation.mjs");
const overlay = rd("src", "renderer", "overlay.js");
const rjs = rd("src", "renderer", "renderer.js");
const idx = rd("src", "renderer", "index.html");
const main = rd("src", "main", "main.mjs");
const preload = rd("src", "main", "preload.cjs");

// 1 — the shared module: on-device STT only, mic released on every stop, narration onEnd re-arms, transcript rows, no network.
{
  assert.match(vc, /import \{ createLocalStt \} from "\.\/local-stt\.mjs"/, "uses the bundled on-device engine");
  assert.match(vc, /import \{ createVoiceState, transition, trimHistory \} from "\.\.\/shared\/voice-turns\.mjs"/, "drives the pure turn machine");
  assert.doesNotMatch(vc, /webkitSpeechRecognition|SpeechRecognition\b|fetch\(|XMLHttpRequest|https?:\/\//, "no cloud recognizer, no network");
  assert.match(vc, /function releaseMic\(\)[\s\S]*?engine\.stop\(\)[\s\S]*?engine = null/, "the mic is released (engine.stop) on stop");
  assert.match(vc, /if \(!modelUrl\) \{ apply\(\{ type: "error", reason: "no-local-model" \}\)/, "no local model → the loop does not start (never cloud)");
  assert.match(vc, /narrate\(e\.text, \{ onEnd: \(\) => \{ speaking = false; if \(active\) apply\(\{ type: "spoken" \}\); \} \}\)/, "narration end → 'spoken' → re-arm when listen:true");
  assert.match(vc, /onTranscript\(\{ who: e\.who, text: e\.text \}\)/, "transcript rows for both sides");
  assert.match(vc, /voice: true/, "asks the brain in voice mode");
  assert.match(vc, /supervisedFix\(\{ recipeId, mode: "confirmed", source: "voice"/, "a spoken yes goes through the gated pipeline");
  assert.match(vc, /voiceApprove\(recipeId\)/, "…and approves the pending ask in-app");
  assert.match(vc, /globeTap: async \(\) => \{[\s\S]*?if \(s\.state === "listening"\) \{ endTurn\(\); return; \}[\s\S]*?if \(s\.state === "speaking"\) \{ cancelNarration\(\)/, "tap while listening ends the turn; tap while speaking interrupts");
}
t();

// 2 — the module runs headless with injected deps: start → listen (mic on) → transcript → chat with history+voice → narrate → re-arm → end phrase → mic off.
{
  const events = [];
  let engineStops = 0, starts = 0;
  let onTextRef = null;
  const narrations = [];
  const convo = createVoiceConversation({
    stt: async ({ modelUrl, onText }) => { starts++; onTextRef = onText; return { stop: () => { engineStops++; } }; },
    voskModelUrl: async () => "file:///model/",
    chat: async (text, ctx) => { events.push({ ask: text, history: ctx.history, voice: ctx.voice }); return { text: "Try turning Wi-Fi off and on. Did that help?", speak: "Try turning Wi-Fi off and on. Did that help?", listen: true, voiceAction: { kind: "guide" } }; },
    narrate: (text, { onEnd }) => { narrations.push(text); setTimeout(onEnd, 1); },
    setGlobeState: (s) => events.push({ globe: s }),
    onTranscript: (row) => events.push({ row }),
    onStatus: (s) => events.push({ status: s })
  });
  await convo.start();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(starts, 1, "mic engine started once"); assert.equal(convo.state(), "listening");
  onTextRef("wifi keeps dropping");
  await new Promise((r) => setTimeout(r, 1300)); // utterance settle + ask + narrate + re-arm
  assert.equal(engineStops, 1, "mic released when the turn ended");
  assert.equal(events.find((e) => e.ask).ask, "wifi keeps dropping");
  assert.equal(events.find((e) => e.ask).voice, true);
  assert.deepEqual(events.find((e) => e.ask).history, [], "first turn has no prior history");
  assert.equal(narrations[0], "Try turning Wi-Fi off and on. Did that help?");
  assert.equal(convo.state(), "listening", "listen:true re-armed the mic"); assert.equal(starts, 2);
  const rows = events.filter((e) => e.row).map((e) => e.row);
  assert.deepEqual(rows.slice(0, 2), [{ who: "me", text: "wifi keeps dropping" }, { who: "aria", text: "Try turning Wi-Fi off and on. Did that help?" }], "both sides transcribed in order");
  onTextRef("that's all");
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal(convo.isActive(), false, "end phrase ends the conversation"); assert.equal(engineStops, 2, "mic released at the end");
  assert.equal(convo.history().length, 2);
}
t();

// 3 — describeFixResult never says "done" for a preview / refusal / pending approval.
{
  assert.match(describeFixResult(null, "Spooler"), /Nothing was changed/);
  assert.match(describeFixResult({ ok: true, verdict: "approval-requested" }, "Spooler"), /waiting for approval/i);
  assert.match(describeFixResult({ ok: true, countdown: true, seconds: 10 }, "Spooler"), /in 10 seconds/);
  assert.match(describeFixResult({ ok: true, policy: { dryRun: true } }, "Spooler"), /previewed[\s\S]*nothing was changed/i);
  assert.match(describeFixResult({ ok: false, verdict: "notify-only", copy: "Found it and flagged it — I'm in observe mode, so nothing was changed." }, "Spooler"), /observe mode/);
  assert.match(describeFixResult({ ok: false, reason: "restore-point-unavailable" }, "Spooler"), /restore point unavailable[\s\S]*Nothing was changed/);
}
t();

// 4 — ARIA tab: 🎤 beside Send (hidden until the local model is confirmed), the toggle, transcript rows via row(), history shared with typed turns.
{
  assert.match(idx, /id="ariaChatMic"[^>]*hidden/, "mic button ships hidden");
  assert.match(idx, /id="ariaChatSend"/, "Send kept");
  assert.match(idx, /id="ariaVoiceConversation"/, "Voice conversation toggle");
  assert.match(idx, /say "that's all" to stop/);
  assert.match(rjs, /import \{ createVoiceConversation \} from "\.\/voice-conversation\.mjs"/);
  assert.match(rjs, /window\.sentinel\.voskModelUrl\(\)\.then\(\(u\) => \{ if \(u\) \{ mic\.hidden = false/, "mic shows ONLY when the bundled model exists");
  assert.match(rjs, /chat: \(text, ctx\) => window\.sentinel\.chat\(text, \{ \.\.\.ctx, history: turns\.slice\(\) \}\)/, "voice turns share the tab's typed history");
  assert.match(rjs, /window\.sentinel\.chat\(msg, \{ history: turns\.slice\(\) \}\)/, "typed asks send history too");
  assert.match(rjs, /if \(who === "me"\) \{ const el = row\("me", text\); el\.classList\.add\("voice"\)/, "spoken turns render as chat rows");
  assert.match(rjs, /voiceApprove: \(recipeId\) => window\.sentinel\.voiceApprove\?\.\(recipeId\)/);
  assert.match(rjs, /function appendFixOffer\(bubble, offer\)/, "a brain fix offer renders one gated Approve control");
  assert.match(preload, /voiceApprove:/); assert.match(main, /ipcMain\.handle\("sentinel:voice-approve"/);
}
t();

// 5 — companion overlay: Voice ASK is multi-turn by default via the shared module; the original one-shot path is KEPT; transcript view in the one card.
{
  assert.match(overlay, /import \{ createVoiceConversation \} from "\.\/voice-conversation\.mjs"/);
  assert.match(overlay, /const VOICE_MULTI_TURN = true;/);
  assert.match(overlay, /if \(VOICE_MULTI_TURN\) \{ await voiceConvo\.start\(\); return; \}/, "startVoiceAsk hands the loop to the shared module");
  assert.match(overlay, /async function stopVoiceAndAnswer\(\)/, "the original one-shot answer path is kept (Rule 15)");
  assert.match(overlay, /if \(voiceConvo\.isActive\(\)\) \{ await voiceConvo\.globeTap\(\); return; \}/, "globe tap drives the loop");
  assert.match(overlay, /function narrateWithEnd\(text, opts\)/, "narration exposes onEnd");
  assert.match(overlay, /u\.addEventListener\("end", fireNarrateEnd\)/, "…fired when the utterance ends");
  assert.match(overlay, /function renderVoiceView\(\)[\s\S]*?companion-transcript/, "transcript renders in the single card");
  assert.match(overlay, /else if \(view\.kind === "voice"\) renderVoiceView\(\)/);
  assert.match(overlay, /voiceApprove: \(recipeId\) => sentinel\.voiceApprove\(recipeId\)/);
}
t();

// 6 — main: chat() forwards {messages: history, voice, platform}, synthesizes speak/listen on the KB-first path, matches a vetted recipe for sentinel-fix.
{
  const chatFn = main.match(/async function chat\(message, context = \{\}\)[\s\S]*?\n\}/)[0];
  assert.match(chatFn, /messages: history,\s*\n\s*voice,/, "history + voice forwarded to askAria → buildChatRequest");
  assert.match(chatFn, /platform: process\.platform/);
  assert.match(chatFn, /return withVoice\(/, "every reply carries voice fields");
  assert.match(main, /const speak = typeof b\.speak === "string" && b\.speak\.trim\(\) \? b\.speak\.trim\(\) : deriveSpeak\(text\)/, "KB-first/local path synthesizes speak from the text");
  assert.match(main, /const needsInput = typeof b\.needs_input === "boolean" \? b\.needs_input : true/, "…listen:true by default so the loop re-arms");
  assert.match(main, /function matchVettedRecipe\(hint, localMatches\)/, "recipeHint matched against the VETTED catalog only");
  assert.match(main, /supervisedVettedCatalog\(\)/);
  assert.match(main, /announce: buildVoiceFixAnnouncement\(/, "'I can fix that here — <title>. Say yes to approve.'");
  assert.match(main, /import \{ buildVoiceFixAnnouncement, deriveSpeak \} from "\.\.\/shared\/voice-turns\.mjs"/);
}
t();

assert.equal(n, 6, "6 voice-conversation-ui groups");
console.log(`voice-conversation-ui test passed (${n} groups · shared module on-device + mic released + re-arm + transcript · headless loop run · honest fix copy · ARIA tab mic/toggle/history · companion multi-turn with one-shot kept · main voice fields + vetted fix offer).`);
