// vision-capture.mjs — STAGE 2 · consent policy for Sentinel's "diagnose my current screen".
// ---------------------------------------------------------------------------------------
// PURE logic only (no electron import) so the consent gate is unit-testable and cannot drift
// from what the main process actually enforces. main.mjs calls decideCapture() BEFORE it ever
// touches desktopCapturer, and again after the user answers the OS dialog.
//
// 🔒 PRIVACY CONTRACT (spec + Rule 14):
//   1. A screen capture NEVER happens without an explicit, per-capture "yes" from the user.
//      Consent is NOT sticky — an old approval cannot silently authorise a new capture.
//   2. The user is told, in plain words, exactly what is captured and where it goes BEFORE
//      the capture, not after.
//   3. A screenshot is pixels: we cannot mask secrets inside it the way we mask text. So the
//      disclosure says the image leaves UNREDACTED, and the user can decline and type instead.
//   4. The image is held in memory for the single request and never written to disk.
//   5. If the kill-switch is engaged or the agent is paused, capture is refused outright.

/** How long a user's "yes" stays valid. Short on purpose: consent is per-capture, not per-session. */
export const CONSENT_TTL_MS = 2 * 60 * 1000;

/** The exact words shown before any capture. Kept here so UI + main process cannot disagree. */
export const CAPTURE_DISCLOSURE = {
  title: 'Let ARIA look at your screen?',
  what: 'ARIA takes ONE still picture of the screen you choose, right now. No video, no audio, no keystrokes, and nothing is saved to disk.',
  where: 'The picture is sent UNREDACTED to the Claude Fable 5 vision model to read the error, because pixels cannot be masked the way text can. Only the text ARIA reads back is filtered for secrets. The picture is not stored afterwards.',
  advice: 'Close anything private first — or cancel and type the error text instead, which is matched offline on our own server and never sent to a third-party model.',
  cancelLabel: 'Cancel',
  confirmLabel: 'Capture this screen once',
};

/**
 * Decide whether a capture may proceed.
 * @param {object} o
 * @param {{screenCapture?:boolean, cloudProcessing?:boolean, ts?:number}} [o.consent] user's answer
 * @param {boolean} [o.agentBlocked] kill-switch engaged or agent paused
 * @param {boolean} [o.captureSupported] platform/runtime can capture at all
 * @param {number}  [o.now]
 * @returns {{allowed:boolean, reason:string|null, requiresConsent:string[], disclosure:object}}
 */
export function decideCapture({ consent, agentBlocked = false, captureSupported = true, now = Date.now() } = {}) {
  const base = { disclosure: CAPTURE_DISCLOSURE, requiresConsent: [], reason: null };

  // Kill-switch / pause outranks consent: if the user has told the agent to stand down,
  // "yes" to a dialog does not re-arm it.
  if (agentBlocked) return { ...base, allowed: false, reason: 'agent-stood-down' };
  if (!captureSupported) return { ...base, allowed: false, reason: 'capture-unsupported' };

  const c = consent || {};
  const missing = [];
  if (c.screenCapture !== true) missing.push('screenCapture');
  if (c.cloudProcessing !== true) missing.push('cloudProcessing');
  if (missing.length) return { ...base, allowed: false, reason: 'consent-required', requiresConsent: missing };

  // Freshness: a stale approval is treated as no approval.
  const ts = Number(c.ts || 0);
  if (!ts || now - ts > CONSENT_TTL_MS || ts - now > 60 * 1000) {
    return { ...base, allowed: false, reason: 'consent-stale', requiresConsent: ['screenCapture', 'cloudProcessing'] };
  }
  return { ...base, allowed: true };
}

/** What we tell the user (and log) about where the bytes went. */
export function captureDataFlow() {
  return {
    captured: 'one still image of the selected screen, held in memory only',
    sentTo: 'Claude Fable 5 vision (Anthropic API), unredacted',
    retention: 'not written to disk, not stored after the response',
    redaction: 'applied to the TEXT the model returns, not to the image itself',
  };
}

/** Audit line for the transparency log — no image data, ever. */
export function captureAuditEntry({ allowed, reason, sourceLabel, now = Date.now() }) {
  return {
    ts: new Date(now).toISOString(),
    tag: 'VISION',
    text: allowed
      ? `Screen captured once with explicit consent (${sourceLabel || 'selected screen'}) and sent to the vision model for diagnosis.`
      : `Screen capture refused (${reason}). Nothing was captured.`,
    consented: !!allowed,
    reason: reason || null,
  };
}
