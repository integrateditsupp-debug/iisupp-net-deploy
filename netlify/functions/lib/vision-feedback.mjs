/**
 * vision-feedback.mjs — STAGE 2 · make "Was this the right fix?" a REAL signal.
 *
 * Before this module the widget rendered the prompt, said "Thanks — noted." and then
 * dropped the answer on the floor unless the host page happened to supply an onFeedback
 * handler. Saying "noted" while noting nothing is a Rule 14 violation, so the widget now
 * posts to the EXISTING `aria-feedback` function (thumbs collection + downvote alert mail)
 * and only claims the answer was recorded when the endpoint actually confirms it.
 *
 * PRIVACY (Stage-2 must-have): the payload carries NO image, NO raw user text or log
 * content, and NO redacted PII. Only facts we already showed the user on screen —
 * which KB article matched, how confident we were, which surface asked, whether the
 * paid vision model was used, and whether we abstained.
 *
 * Pure + dependency-free so both the browser widget and the tests can use it.
 */

const FEEDBACK_ENDPOINT = '/.netlify/functions/aria-feedback';

/**
 * Stable, non-identifying id for one diagnosis, so an up/down vote can be correlated
 * back to the answer that earned it. Deliberately contains no user content: surface,
 * input kind, matched slug (or `abstain`), confidence bucket, and a short time salt.
 */
export function newDiagnosisId({ surface, kind, slug, confidence, now } = {}) {
  const t = Number.isFinite(now) ? now : Date.now();
  const parts = [
    'vd',
    safe(surface) || 'web',
    safe(kind) || 'text',
    safe(slug) || 'abstain',
    Math.max(0, Math.min(100, Math.round(Number(confidence) || 0))),
    t.toString(36),
  ];
  return parts.join('.').slice(0, 120);
}

/**
 * Turn a diagnose response + the user's yes/no into the exact body `aria-feedback`
 * expects: { msg_id, vote:'up'|'down', intent, text, comment }.
 *
 * Returns null when there is nothing honest to send (no result at all).
 */
export function buildFeedbackPayload({ helpful, result, surface } = {}) {
  if (!result || typeof result !== 'object') return null;

  const d = result.diagnosis || null;
  const abstained = result.abstain === true || !d;
  const conf = Math.max(0, Math.min(100, Math.round(Number(result.confidence) || 0)));
  const usedVision = !!(result.meta && result.meta.visionUsed);
  const surf = safe(surface || result.surface) || 'web';
  const kind = safe(result.kind) || 'text';

  const msgId = safe(result.diagnosisId) || newDiagnosisId({
    surface: surf, kind, slug: d && d.slug, confidence: conf,
  });

  // `intent` is aria-feedback's grouping key — keep it coarse and content-free.
  const intent = 'vision-diagnose:' + (abstained ? 'abstain' : (safe(d.slug) || 'matched'));

  // `text` is what the user is voting ON. Only the headline we already displayed —
  // never the pasted log, never the OCR'd screen text, never a redacted string.
  const text = abstained
    ? 'ARIA abstained (no confident match) - user says this was ' + (helpful ? 'still useful' : 'not useful')
    : String(d.title || 'diagnosis').slice(0, 200);

  // `comment` is the machine context a reviewer needs, in one honest line.
  const comment = [
    'surface=' + surf,
    'kind=' + kind,
    'confidence=' + conf,
    'label=' + (safe(result.confidenceLabel) || 'unknown'),
    'abstain=' + (abstained ? 'yes' : 'no'),
    'visionUsed=' + (usedVision ? 'yes' : 'no'),
    'oneClickFix=' + (result.fix && result.fix.oneClickEligible ? 'yes' : 'no'),
  ].join(' | ');

  return {
    msg_id: msgId,
    vote: helpful ? 'up' : 'down',
    intent: intent.slice(0, 60),
    text,
    comment: comment.slice(0, 600),
  };
}

/**
 * POST the vote. Resolves { recorded:boolean, reason?:string } — never throws, and
 * NEVER reports recorded:true unless the endpoint returned ok. The widget's on-screen
 * wording is driven entirely by this flag (Rule 14).
 */
export async function sendFeedback({ helpful, result, surface, endpoint, fetchImpl } = {}) {
  const payload = buildFeedbackPayload({ helpful, result, surface });
  if (!payload) return { recorded: false, reason: 'nothing-to-send' };

  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { recorded: false, reason: 'no-transport' };

  try {
    const r = await f(endpoint || FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r || !r.ok) return { recorded: false, reason: 'http-' + ((r && r.status) || 'error') };
    return { recorded: true, payload };
  } catch (e) {
    return { recorded: false, reason: (e && e.message) || 'network' };
  }
}

export { FEEDBACK_ENDPOINT };

function safe(v) {
  if (v == null) return '';
  return String(v).replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 60);
}
