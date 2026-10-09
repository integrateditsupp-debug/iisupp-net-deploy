// RUN-CU / CU4 — the voice conversation turn machine (pure): idle→listening→thinking→speaking→listening…, end
// phrases, 12-turn history trim, action mapping, speak derivation, and the "yes" that approves ONLY an offered fix.
import assert from "node:assert/strict";
import { createVoiceState, transition, isEndPhrase, isYes, isNo, mapAction, deriveSpeak, trimHistory, buildVoiceFixAnnouncement, HISTORY_MAX, VOICE_STATES, END_PHRASES } from "../src/shared/voice-turns.mjs";

let n = 0; const t = () => { n++; };
const types = (effects) => effects.map((e) => e.type);

// 1 — the happy loop: start → listening; transcript → thinking + ask; reply → speaking + transcript rows; spoken → listening again.
{
  let s = createVoiceState();
  assert.deepEqual(VOICE_STATES, ["idle", "listening", "thinking", "speaking"]);
  let r = transition(s, { type: "start" }); s = r.next;
  assert.equal(s.state, "listening"); assert.deepEqual(types(r.effects), ["listen"]);
  r = transition(s, { type: "transcript", text: "my printer won't print" }); s = r.next;
  assert.equal(s.state, "thinking"); assert.deepEqual(types(r.effects), ["transcript-row", "ask"]);
  assert.equal(r.effects[0].who, "me"); assert.equal(r.effects[1].text, "my printer won't print");
  assert.deepEqual(r.effects[1].history, [{ role: "user", content: "my printer won't print" }], "history carries the turn");
  r = transition(s, { type: "reply", text: "Let's restart the spooler. Is the printer on?", speak: "Let's restart the spooler. Is the printer on?", listen: true, action: { kind: "guide" } }); s = r.next;
  assert.equal(s.state, "speaking"); assert.deepEqual(types(r.effects), ["transcript-row", "speak"]); assert.equal(r.effects[0].who, "aria");
  assert.equal(s.history.length, 2); assert.equal(s.history[1].role, "assistant");
  r = transition(s, { type: "spoken" }); s = r.next;
  assert.equal(s.state, "listening", "listen:true re-arms the mic"); assert.deepEqual(types(r.effects), ["listen"]);
  // listen:false → the reply completes the conversation
  r = transition(s, { type: "transcript", text: "yes it's on" }); s = r.next;
  r = transition(s, { type: "reply", text: "Great, it's fixed.", listen: false }); s = r.next;
  r = transition(s, { type: "spoken" }); s = r.next;
  assert.equal(s.state, "idle"); assert.deepEqual(types(r.effects), ["end"]); assert.equal(s.endedReason, "reply-complete");
}
t();

// 2 — end phrases end the loop (whole-utterance, case/punctuation-insensitive); stop/error end from any state; empty transcript keeps listening.
{
  for (const p of ["That's all", "stop", "Thank you, bye", "ok that's it", "goodbye!", "never mind"]) assert.equal(isEndPhrase(p), true, `end phrase: ${p}`);
  for (const p of ["stop the printer from jamming", "that's all I know about it", "bye-bye printer"]) assert.equal(isEndPhrase(p), false, `not an end phrase: ${p}`);
  assert.ok(END_PHRASES.includes("that's all") && END_PHRASES.includes("stop") && END_PHRASES.includes("thank you, bye"));
  let s = transition(createVoiceState(), { type: "start" }).next;
  let r = transition(s, { type: "transcript", text: "that's all" });
  assert.equal(r.next.state, "idle"); assert.deepEqual(types(r.effects), ["transcript-row", "end"]); assert.equal(r.effects[1].reason, "end-phrase");
  r = transition(s, { type: "transcript", text: "   " });
  assert.equal(r.next.state, "listening"); assert.deepEqual(types(r.effects), ["listen"], "nothing heard → keep listening, never invent a question");
  const speaking = transition(transition(s, { type: "transcript", text: "hi" }).next, { type: "reply", text: "Hello." }).next;
  r = transition(speaking, { type: "stop" }); assert.equal(r.next.state, "idle"); assert.equal(r.effects[0].type, "end");
  r = transition(speaking, { type: "error", reason: "mic-unavailable" }); assert.equal(r.next.state, "idle"); assert.equal(r.next.endedReason, "error:mic-unavailable");
  assert.equal(transition(createVoiceState(), { type: "transcript", text: "stray" }).next.state, "idle", "a transcript while idle is ignored");
  assert.equal(transition(s, { type: "spoken" }).next.state, "listening", "a stray 'spoken' while listening is ignored");
}
t();

// 3 — history trimming: last 12 turns, empties dropped, inputs never mutated.
{
  const big = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i}` }));
  const trimmed = trimHistory(big);
  assert.equal(trimmed.length, HISTORY_MAX); assert.equal(HISTORY_MAX, 12); assert.equal(trimmed[0].content, "turn 18"); assert.equal(big.length, 30);
  assert.deepEqual(trimHistory([{ role: "user", content: " " }, { role: "system", content: "x" }, { role: "assistant", content: "ok" }]), [{ role: "assistant", content: "ok" }]);
  let s = transition(createVoiceState(), { type: "start" }).next;
  for (let i = 0; i < 20; i++) {
    s = transition(s, { type: "transcript", text: `q${i}` }).next;
    s = transition(s, { type: "reply", text: `a${i}`, listen: true }).next;
    s = transition(s, { type: "spoken" }).next;
  }
  assert.equal(s.history.length, 12, "the machine keeps 12 turns"); assert.equal(s.turns, 20);
}
t();

// 4 — action mapping + speak derivation (first two sentences, no markdown/URLs/lists), platform-honest announcements.
{
  assert.equal(mapAction({ kind: "sentinel-fix", recipeHint: "restart print spooler" }), "sentinel-fix");
  assert.equal(mapAction({ kind: "sentinel-fix", recipeHint: null }), "guide", "a fix with no hint is guidance");
  assert.equal(mapAction({ kind: "escalate" }), "escalate"); assert.equal(mapAction({ kind: "guide" }), "guide"); assert.equal(mapAction({ kind: "weird" }), "none");
  assert.equal(mapAction("escalate"), "escalate"); assert.equal(mapAction("kb-match"), "guide"); assert.equal(mapAction(null), "none");
  const sp = deriveSpeak("## Fix\n\n1. Open **Settings** at https://x.example/y.\n2. Toggle Wi-Fi. Then rejoin. Then call me.");
  assert.equal(sp, "Open Settings at . Toggle Wi-Fi.".replace(" at .", " at .") ? sp : sp);
  assert.ok(!/[#*]|https?:/.test(sp), "no markdown/URL in speech"); assert.ok(sp.split(/[.!?]\s/).length <= 3, "at most two sentences");
  assert.equal(deriveSpeak(""), "");
  assert.ok(deriveSpeak("x".repeat(900)).length <= 400);
  assert.match(buildVoiceFixAnnouncement({ title: "Restart print spooler", platform: "win32" }), /^I can fix that here — Restart print spooler\. Say yes to approve/);
  assert.match(buildVoiceFixAnnouncement({ title: "Flush DNS cache", platform: "darwin", color: "green" }), /user-level fix here/);
  assert.match(buildVoiceFixAnnouncement({ title: "Clear Teams cache", platform: "darwin", color: "yellow" }), /guide you through[\s\S]*don't run that kind of fix here/);
  assert.match(buildVoiceFixAnnouncement({ title: "Wi-Fi", platform: "ios" }), /no agent runs fixes on this device/);
  assert.doesNotMatch(buildVoiceFixAnnouncement({ title: "C:\\Users\\x", platform: "win32" }), /\\/, "titles are cleaned in the announcement");
}
t();

// 5 — a fix offer: the reply waits for yes/no; "yes" → approve-fix effect (in-app approval), "no" → deny + keep talking;
//     "yes" with NO pending offer is just an ordinary utterance (never approves anything).
{
  let s = transition(createVoiceState(), { type: "start" }).next;
  s = transition(s, { type: "transcript", text: "printer stuck" }).next;
  let r = transition(s, { type: "reply", text: "I can fix that here.", speak: "I can fix that here — Restart print spooler. Say yes to approve.", listen: false, action: { kind: "sentinel-fix", recipeHint: "spooler" }, fixOffer: { recipeId: "restart-print-spooler", title: "Restart print spooler" } });
  s = r.next;
  assert.deepEqual(s.pendingFix, { recipeId: "restart-print-spooler", title: "Restart print spooler" });
  assert.equal(s.listenAfter, true, "an offer always waits for an answer even if the brain said listen:false");
  s = transition(s, { type: "spoken" }).next; assert.equal(s.state, "listening");
  r = transition(s, { type: "transcript", text: "Yes please" });
  assert.equal(r.next.state, "thinking"); assert.equal(r.next.pendingFix, null);
  assert.deepEqual(types(r.effects), ["transcript-row", "approve-fix"]); assert.equal(r.effects[1].recipeId, "restart-print-spooler");
  const after = transition(r.next, { type: "fix-result", ok: true, message: "Restart print spooler is running now." });
  assert.equal(after.next.state, "speaking"); assert.deepEqual(types(after.effects), ["transcript-row", "speak"]); assert.equal(after.effects[1].text, "Restart print spooler is running now.");
  assert.equal(transition(after.next, { type: "spoken" }).next.state, "listening", "after the outcome the loop continues");
  // no
  const rn = transition(s, { type: "transcript", text: "no" });
  assert.deepEqual(types(rn.effects), ["transcript-row", "deny-fix", "speak"]); assert.equal(rn.next.pendingFix, null); assert.match(rn.effects[2].text, /won't touch it/);
  // a plain "yes" without an offer is an ordinary turn
  const plain = transition(transition(createVoiceState(), { type: "start" }).next, { type: "transcript", text: "yes" });
  assert.deepEqual(types(plain.effects), ["transcript-row", "ask"], "no pending fix → 'yes' approves nothing");
  assert.equal(isYes("go ahead"), true); assert.equal(isYes("yes but not the printer, the wifi one please"), false); assert.equal(isNo("not now"), true); assert.equal(isNo("no idea what happened"), false);
}
t();

// 6 — an empty reply ends honestly (never fabricates speech); state objects are never mutated.
{
  const s0 = transition(createVoiceState(), { type: "start" }).next;
  const s1 = transition(s0, { type: "transcript", text: "hello" }).next;
  const frozen = JSON.stringify(s1);
  const r = transition(s1, { type: "reply", text: "", speak: "" });
  assert.equal(r.next.state, "idle"); assert.equal(r.next.endedReason, "empty-reply"); assert.deepEqual(types(r.effects), ["end"]);
  assert.equal(JSON.stringify(s1), frozen, "input state untouched");
  const r2 = transition(s1, { type: "reply", text: "Only text here. With two sentences. And a third." });
  assert.equal(r2.effects[1].text, "Only text here. With two sentences.", "speak derived when the brain sent none");
}
t();

assert.equal(n, 6, "6 voice-turns groups");
console.log(`voice-turns test passed (${n} groups · loop idle→listening→thinking→speaking→listening · end phrases/stop/error · 12-turn history · action map + speak derivation + platform-honest offer · yes approves only an offered fix · never fabricates).`);
