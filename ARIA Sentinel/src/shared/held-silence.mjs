// held-silence.mjs — RUN-Z Z2: SILENCE, HELD HONESTLY.
//
// WHY (RUN-Z, 2026-07-29): the state between a send and any answer is where every outreach program starts
// lying. Silence gets read as "not interested" (a decline that was never given), or as "they must be busy,
// send again harder" (an escalation the prospect never invited), or — worst — it quietly gets counted as
// something, so the numbers keep moving while nothing happened.
//
// Silence is none of those. Silence is one fact: a message left on a date, and no answer has arrived since.
//
// Honesty invariants (Rule 14):
//   - SILENCE IS NOT A REPLY, NOT A DECLINE, AND NOT A SIGNAL. It is elapsed time against a real date.
//   - IT MUST NOT CHARACTERISE INTENT. Nothing here may say the prospect is busy, uninterested, ghosting,
//     cold, warm, thinking about it, or ready. A test greps every rendered line against an intent
//     vocabulary and fails on a hit.
//   - IT MUST NOT MOVE THE LADDER. No length of silence promotes, demotes or otherwise changes any rung of
//     the W1 outcome ladder, any cost component that only a real event lowers, or the disposition of any
//     route. A test holds a ladder for 400 days of silence and deep-equals it against the original.
//   - IT MUST NOT ESCALATE TONE. There is no "third attempt" voice. Silence produces no message at all.
//   - `unverified` != `no silence`. A send with no stated date is unverified elapsed time, not zero days.
//   - NO IDENTITY (vault Rule 11). Opaque handles only.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence, nothing replaced.

export const HELD_SILENCE_SCHEMA = "held-silence.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const CHARACTERISES_INTENT = false;
export const ESCALATES_TONE = false;

export const UNVERIFIED = "unverified";
export const SILENT = "silent";
export const ANSWERED = "answered";

export const SILENCE_IS_NOT_NOTE =
  "Silence is not a reply, not a decline, and not a signal. It is elapsed time measured against a real " +
  "send date. It moves no rung of the ladder, lowers no cost, and changes no route's disposition.";

export const NO_ESCALATION_NOTE =
  "There is no escalating voice in this program. Silence produces no message, no reminder and no sharper " +
  "second draft. If a route becomes worth acting on again, a real date says so — not the quiet.";

/** Intent vocabulary. Nothing this module renders may contain any of it. */
export const INTENT_PATTERNS = Object.freeze([
  /\bnot interested\b/i, /\buninterested\b/i, /\bghost(ing|ed)\b/i, /\bignoring\b/i,
  /\bthey'?re busy\b/i, /\bprobably\b/i, /\bseems? (to|like)\b/i, /\blikely\b/i,
  /\bcold\b/i, /\bwarm(ing)?\b/i, /\bthinking (it )?over\b/i, /\bon the fence\b/i,
  /\bready to buy\b/i, /\bno longer\b/i, /\blost interest\b/i,
]);

/** Escalation vocabulary. Silence must never produce any of it. */
export const ESCALATION_PATTERNS = Object.freeze([
  /\bfollow(ing)? up again\b/i, /\bsecond attempt\b/i, /\bthird attempt\b/i, /\bbumping\b/i,
  /\bjust checking in\b/i, /\bcircling back\b/i, /\bnudge\b/i, /\bchasing\b/i,
]);

const DAY = 86400000;
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/**
 * Build the silence view.
 *
 * @param input.sent[]      { handle, sentOn }  — an event the operator recorded (Y1) or the mail record
 *                          established. A drafted body is not a send and must never appear here.
 * @param input.answered[]  { handle, answeredOn } — a real reply captured by W1.
 * @param opts.now          clock.
 */
export function buildHeldSilence(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);

  const sent = Array.isArray(input?.sent) ? input.sent : [];
  const answeredSet = new Map(
    (Array.isArray(input?.answered) ? input.answered : [])
      .filter((a) => a && isStr(a.handle))
      .map((a) => [a.handle.trim(), isStr(a.answeredOn) ? a.answeredOn : UNVERIFIED])
  );

  const held = [];
  const answered = [];
  const refused = [];

  for (const s of sent) {
    const handle = isStr(s?.handle) ? s.handle.trim() : null;
    if (!handle) {
      refused.push(Object.freeze({ handle: null, reasons: Object.freeze(["no handle stated"]) }));
      continue;
    }
    if (CARRIES_IDENTITY(handle)) {
      refused.push(Object.freeze({
        handle: null,
        reasons: Object.freeze(["entry carries an address or a domain (vault Rule 11) — refused"]),
      }));
      continue;
    }

    if (answeredSet.has(handle)) {
      answered.push(Object.freeze({
        handle,
        answeredOn: answeredSet.get(handle),
        state: ANSWERED,
        line: `${handle} — an answer arrived on ${answeredSet.get(handle)}. This is not silence.`,
      }));
      continue;
    }

    const sentMs = isStr(s.sentOn) ? Date.parse(s.sentOn) : NaN;
    if (!Number.isFinite(sentMs)) {
      held.push(Object.freeze({
        handle,
        sentOn: UNVERIFIED,
        elapsedDays: UNVERIFIED,
        state: SILENT,
        // Deliberately NOT "0 days". Not knowing when it left is different from it having left today.
        line: `${handle} — a message left, and the date it left was never stated. Elapsed silence is ` +
              `${UNVERIFIED}, which is not the same as none.`,
      }));
      continue;
    }

    const days = Math.max(0, Math.floor((nowMs - sentMs) / DAY));
    held.push(Object.freeze({
      handle,
      sentOn: s.sentOn,
      elapsedDays: days,
      state: SILENT,
      line: `${handle} — a message left on ${s.sentOn}. ${days} day${days === 1 ? "" : "s"} have passed ` +
            `and no answer has arrived. That is the whole fact.`,
    }));
  }

  return Object.freeze({
    schema: HELD_SILENCE_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    held: Object.freeze(held),
    answered: Object.freeze(answered),
    refused: Object.freeze(refused),
    heldCount: held.length,
    answeredCount: answered.length,
    silenceIsNotNote: SILENCE_IS_NOT_NOTE,
    noEscalationNote: NO_ESCALATION_NOTE,
  });
}

/**
 * The load-bearing function of Z2: what silence does to the rest of the program.
 *
 * It returns the input untouched. That is the entire point, and it is a function rather than a comment so
 * a test can call it with 400 days of silence and deep-equal the result against the original.
 */
export function applySilenceTo(state, _silence) {
  return state;
}

/** Silence never produces a message. Returns null, always, whatever the elapsed time. */
export function messageFromSilence(_silence) {
  return null;
}

/** Render exactly what the operator reads. */
export function renderHeldSilence(s) {
  const L = [];
  L.push("# WAITING");
  L.push("");
  L.push(s.silenceIsNotNote);
  L.push("");
  if (!s.held.length && !s.answered.length) {
    L.push("No message has left, so there is nothing waiting. Stated, not rendered as silence.");
    L.push("");
    L.push(s.noEscalationNote);
    return L.join("\n");
  }
  if (s.held.length) {
    L.push(`## Waiting — ${s.held.length}`);
    for (const h of s.held) L.push(`- ${h.line}`);
    L.push("");
  }
  if (s.answered.length) {
    L.push(`## Answered — ${s.answered.length}`);
    for (const a of s.answered) L.push(`- ${a.line}`);
    L.push("");
  }
  if (s.refused.length) {
    L.push(`## Refused entries — shown, never dropped: ${s.refused.length}`);
    L.push("");
  }
  L.push(s.noEscalationNote);
  return L.join("\n");
}

/** Findings, not a boolean: intent-characterisation, escalation or identity in the rendered output. */
export function heldSilenceLeaks(s) {
  const text = renderHeldSilence(s);
  const found = [];
  if (CARRIES_IDENTITY(text)) found.push("rendered output carries an address or a domain (vault Rule 11)");
  for (const p of INTENT_PATTERNS) {
    if (p.test(text)) found.push(`rendered output characterises intent, matching ${p}`);
  }
  for (const p of ESCALATION_PATTERNS) {
    if (p.test(text)) found.push(`rendered output escalates tone, matching ${p}`);
  }
  return Object.freeze(found);
}

/** Flat fact set for the AXIS feed / ledger. Counts only, no identity. */
export function heldSilenceFacts(s) {
  return Object.freeze({
    schema: HELD_SILENCE_SCHEMA,
    waiting: s.heldCount,
    answered: s.answeredCount,
    refused: s.refused.length,
    silenceMovesLadder: false,
  });
}
