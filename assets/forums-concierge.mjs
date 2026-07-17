// ARIA Forums — CONCIERGE: auto-answer help posts from the REAL KB, $0, honest-abstain.
// -----------------------------------------------------------------------------------------------
// Watches the forums and, for a genuine unanswered help post, retrieves the best match from the real
// KB (assets/aria-kb-chunks.json via forums-retriever) and posts a clearly-labelled "ARIA · auto-answer"
// reply that LEADS with the plain-language explanation + fix steps (shaped end-user-safe — no internal
// notes / registry ever) and carries an honest tail. It marks the thread "Answered by ARIA" so future
// searchers find it (evergreen Q&A). It NEVER fabricates: below the abstain floor it declines silently.
//
// $0: KB retrieval + local text only. No paid LLM in this path.
// Rules: never double-answer, never answer a human-answered thread, never answer a non-help post.
// Pure — no I/O, no store writes. The cron/handler do the reads + the single labelled write.

import { toDoc, retrieve, summarize, ABSTAIN_THRESHOLD, normalizeConfidence, confidenceBand } from "./forums-retriever.mjs";
import { shapeKbAnswerForEndUser, isEndUserSafe } from "./kb-answer-shape.mjs";

export const BOT_LABEL = "ARIA · auto-answer";
export const BOT_EMAIL = "aria-bot@iisupp.net"; // identity marker only; the post is flagged bot:true (clearly not a human)
export const CURATION_RAW = 20; // strong (band "high") Q&A pairs → curation queue (never auto-published to the KB)

// Honest tail — ARIA guides, it does not act on the user's device (Rule 14). Reused from the chat HONEST_TAIL spirit.
export const HONEST_TAIL =
  "— ARIA auto-answer, sourced from the IIS knowledge base. This is guidance; ARIA can't make changes on your device. " +
  "If it didn't resolve it, reply here or contact IIS to escalate.";

// Greetings / chit-chat / thanks that are not help requests.
const CHITCHAT = /^\s*(hi|hey|hello|thanks?|thank you|ty|cheers|lol|test|testing|good (morning|afternoon|evening))\b[\s!.]*$/i;

const firstPost = (thread) => (thread && Array.isArray(thread.posts) && thread.posts[0]) || null;
const queryOf = (thread) => `${(thread && thread.title) || ""}\n${(firstPost(thread) && firstPost(thread).body) || ""}`.trim();

/** Has a HUMAN already replied (any non-OP, non-bot post)? Then the concierge stays out. */
export function humanAnswered(thread) {
  const posts = (thread && thread.posts) || [];
  if (posts.length < 2) return false;
  return posts.slice(1).some((p) => !p.bot && !(p.author && p.author.bot));
}

/** Has ARIA already answered this thread (idempotent — never double-answer)? */
export function ariaAnswered(thread) {
  if (thread && thread.ariaAnswered) return true;
  const posts = (thread && thread.posts) || [];
  return posts.some((p) => p.bot || (p.author && p.author.bot));
}

/** Is this a genuine help post worth answering (not a greeting / too short / already handled)? */
export function isHelpPost(thread) {
  const fp = firstPost(thread);
  if (!fp) return false;
  const body = String(fp.body || "").trim();
  const title = String(thread.title || "").trim();
  if ((title + " " + body).length < 12) return false;
  if (CHITCHAT.test(body) && !/\?/.test(title + body)) return false;
  return true;
}

/**
 * Assess a thread and, if answerable, build the labelled auto-answer body.
 * @param {object} thread   raw stored thread { title, posts:[{body,...}], ariaAnswered? }
 * @param {Array}  chunks   raw KB chunks (aria-kb-chunks.json `chunks`)
 * @param {object} [opts]   { communityDocs } graduated community answers to also rank
 * @returns {{eligible:boolean, skipReason:string, abstain:boolean, answer:(string|null),
 *            confidence:{raw:number,value:number,band:string}, articleSlug:string, articleTitle:string,
 *            curationCandidate:boolean}}
 */
export function assessThread(thread, chunks, opts = {}) {
  const base = { eligible: false, skipReason: "", abstain: false, answer: null, confidence: { raw: 0, value: 0, band: "low" }, articleSlug: "", articleTitle: "", curationCandidate: false };

  if (ariaAnswered(thread)) return { ...base, skipReason: "aria-already-answered" };
  if (humanAnswered(thread)) return { ...base, skipReason: "human-answered" };
  if (!isHelpPost(thread)) return { ...base, skipReason: "not-a-help-post" };

  const docs = (chunks || []).map(toDoc);
  const res = retrieve(queryOf(thread), docs, { topK: 4, communityDocs: opts.communityDocs || [] });
  const conf = { raw: res.confidence.raw, value: normalizeConfidence(res.confidence.raw), band: confidenceBand(res.confidence.raw) };

  // Honest abstain — below the floor we NEVER post a fabricated answer.
  if (res.abstain || !res.top) return { ...base, eligible: true, abstain: true, skipReason: "below-confidence-floor", confidence: conf };

  const top = res.top.doc;
  const shaped = shapeKbAnswerForEndUser(top.body || summarize(top) || "");
  const answer = composeAnswer(shaped, top);
  // Defense in depth: if shaping somehow left an internal marker, decline rather than leak.
  if (!isEndUserSafe(answer)) return { ...base, eligible: true, abstain: true, skipReason: "unsafe-after-shape", confidence: conf };

  return {
    eligible: true,
    skipReason: "",
    abstain: false,
    answer,
    confidence: conf,
    articleSlug: top.slug || "",
    articleTitle: top.title || "",
    curationCandidate: conf.raw >= CURATION_RAW
  };
}

/** Compose the posted reply: shaped KB answer (explanation + steps + escalate) + a source line + the honest tail. */
export function composeAnswer(shaped, doc) {
  const src = doc && doc.slug ? `\n\nSource: IIS KB · ${doc.title || doc.slug} (${doc.slug})` : "";
  return `${String(shaped || "").trim()}${src}\n\n${HONEST_TAIL}`.trim();
}

/** Build the bot post object the store appends (same schema as human posts, clearly flagged bot). */
export function botPost(body, now, idSuffix = "aria") {
  return {
    id: `p-${now.toString(36)}-${idSuffix}`,
    author: { id: "aria-bot", name: "ARIA", verified: false, bot: true },
    body: String(body || ""),
    ts: now,
    voters: {},
    accepted: false,
    bot: true,
    botLabel: BOT_LABEL
  };
}
