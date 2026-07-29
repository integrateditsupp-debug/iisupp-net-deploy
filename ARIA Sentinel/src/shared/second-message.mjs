// second-message.mjs — RUN-V V2: THE SECOND MESSAGE, REFUSABLE.
//
// WHY (RUN-V, 2026-07-29): the highest-probability message this program has ever had the chance to write
// is the second one — to a named, warm, prospect-supplied contact from V1's queue. This module drafts the
// shortest honest follow-up for each route class. It is the same contract S2 established for the first
// message: every unsupportable claim class is REFUSABLE BY NAME, with its reason, so the draft cannot
// quietly acquire warmth it has not earned.
//
// Honesty invariants (Rule 14):
//   - DRAFTS ONLY. No transport, no scheduler, no send path exists in this module. A static scan (the
//     test greps the source) proves the code cannot send. Sending stays Ahmad's click.
//   - REFUSABLE BY NAME. Four unsupportable claim classes are refused with a stated reason:
//       fabricated-referral-warmth · invented-urgency · implied-prior-relationship · invented-mutual-contact
//     A draft that would carry any of them is returned as REFUSED, never softened into shipping.
//   - SAYS WHERE THE REFERRAL CAME FROM, PLAINLY. Each draft states the true provenance of the route
//     (an autoresponder redirect, a stated return date, a keep-on-file) and claims nothing else.
//   - NOTHING UNTRUE OF IIS TODAY. No guarantee/money-back/risk-free language (standing rule 7). 15+ years,
//     founder-led, real clients only. A test asserts none of the banned claim strings can appear.
//   - NO IDENTITY (Rule 11). Drafts address a route by its opaque handle and its class, never a name.
//   - PURE + ADDITIVE (Rule 15). No fs, no net; new surface, replaces nothing.

export const SECOND_MESSAGE_SCHEMA = "second-message.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;

/** The claim classes a draft is REFUSED for carrying. Refusable-by-name, S2's pattern. */
export const REFUSABLE_CLAIMS = Object.freeze([
  "fabricated-referral-warmth",   // implying the referral is warmer than "your autoresponder named you"
  "invented-urgency",             // a deadline or scarcity the prospect never stated
  "implied-prior-relationship",   // "great to reconnect" / "as discussed" with someone we never spoke to
  "invented-mutual-contact",      // naming a shared connection we cannot support
]);

/** Banned language on any IIS-facing copy (standing rule 7 + resume honesty). */
export const BANNED_PHRASES = Object.freeze([
  "guarantee", "money-back", "money back", "risk-free", "risk free",
  "21 years", "21+ years", "as discussed", "as we discussed", "reconnect",
  "per our conversation", "as promised", "urgent", "act now", "limited time",
]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/**
 * The true provenance line for each route class — where the opening actually came from, said plainly.
 * This is the ONLY warmth a draft is allowed to claim.
 */
const PROVENANCE = Object.freeze({
  "redirected-to-a-colleague":
    "Your team's auto-reply pointed me to you as the right person for IT support — passing my note along directly.",
  "successor-firm":
    "I reached out to a firm your auto-reply said your team has taken over — sending this to you instead, as suggested.",
  "back-from-vacation":
    "You had mentioned being back around now, so I'm following up as you'd asked.",
  "declined-keep-on-file":
    "You'd asked to be kept on file rather than pursued — this is a brief, no-pressure check-in, nothing more.",
});

/** The single honest ask for each class. Short. Nothing untrue of IIS today. */
const ASK = Object.freeze({
  "redirected-to-a-colleague":
    "IIS is a founder-led IT support shop (15+ years hands-on, real Ontario clients). If managed IT or a second set of eyes is useful, worth a 15-minute call?",
  "successor-firm":
    "IIS handles day-to-day IT support and monitoring for small Ontario businesses, founder-led. If you've inherited systems worth a look, happy to do a short no-obligation review.",
  "back-from-vacation":
    "Nothing's changed on my end — still happy to walk you through what IIS would cover. 15 minutes whenever suits.",
  "declined-keep-on-file":
    "No ask today. If your IT situation shifts, my details are here. I'll keep it light and infrequent.",
});

/**
 * Draft the second message for one route (from V1's queue).
 * Returns either { ok:true, draft } or { ok:false, refused, reasons } — refused drafts never ship.
 * @param route  a V1 route object (opaque handle + routeClass)
 * @param opts   { assertClaims?: string[] }  claim classes the caller wants to *make* — any that are
 *               in REFUSABLE_CLAIMS cause the draft to be refused by name. This is how a caller proves
 *               the refusal is real: ask for warmth you can't support and the module says no.
 */
export function draftSecondMessage(route = {}, { assertClaims = [] } = {}) {
  const problems = [];
  const handle = isStr(route.handle) ? route.handle.trim() : null;
  if (!handle) problems.push("route has no handle");
  else if (CARRIES_IDENTITY(handle)) problems.push("handle carries an address or domain (vault Rule 11)");

  const routeClass = isStr(route.routeClass) ? route.routeClass.trim() : null;
  if (!routeClass || !(routeClass in PROVENANCE)) problems.push(`no honest template for routeClass "${routeClass}"`);

  // Refusal-by-name: any requested claim in the refusable set kills the draft, with the reason.
  const refusedClaims = (Array.isArray(assertClaims) ? assertClaims : [])
    .map((c) => String(c || "").trim())
    .filter((c) => REFUSABLE_CLAIMS.includes(c));

  if (problems.length) return Object.freeze({ ok: false, refused: "malformed", reasons: problems });
  if (refusedClaims.length) {
    return Object.freeze({
      ok: false,
      refused: "unsupportable-claim",
      reasons: refusedClaims.map((c) => `refused claim "${c}": this message may claim only that a prospect's own auto-reply or stated date created the opening — nothing warmer.`),
    });
  }

  const body = [PROVENANCE[routeClass], "", ASK[routeClass]].join("\n");

  // Final guard: the assembled body must carry no banned language and no identity.
  const lower = body.toLowerCase();
  const banned = BANNED_PHRASES.filter((p) => lower.includes(p));
  if (banned.length) {
    return Object.freeze({ ok: false, refused: "banned-language", reasons: banned.map((p) => `banned phrase "${p}" (standing rule 7 / resume honesty)`) });
  }
  if (CARRIES_IDENTITY(body)) {
    return Object.freeze({ ok: false, refused: "identity-leak", reasons: ["draft body carries an address or domain (vault Rule 11)"] });
  }

  return Object.freeze({
    ok: true,
    draft: Object.freeze({
      schema: SECOND_MESSAGE_SCHEMA,
      handle,
      routeClass,
      provenance: PROVENANCE[routeClass],
      body,
      mode: isStr(route.mode) ? route.mode : "unknown",
      sendIs: "a human click — this module cannot send, and a static scan of it proves so.",
    }),
  });
}

/** Draft the whole V1 queue. Refused drafts are returned as findings, never dropped or auto-fixed. */
export function draftQueue(queue = []) {
  const drafts = [];
  const refused = [];
  for (const route of Array.isArray(queue) ? queue : []) {
    const r = draftSecondMessage(route);
    if (r.ok) drafts.push(r.draft);
    else refused.push({ handle: route && route.handle, refused: r.refused, reasons: r.reasons });
  }
  return Object.freeze({ schema: SECOND_MESSAGE_SCHEMA, drafts: Object.freeze(drafts), refused: Object.freeze(refused) });
}
