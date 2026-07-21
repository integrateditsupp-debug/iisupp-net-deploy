// aria-vision-diagnose.mjs — STAGE 2 "show, don't type" endpoint (Fable 5 vision → diagnosis).
// ---------------------------------------------------------------------------------------------
// One engine, three surfaces (ARIA web upload/paste · Sentinel screenshot · Forums "Ask AI").
//
// POST JSON:
//   {
//     surface: 'web'|'sentinel'|'forums',
//     kind:    'text'|'log'|'pdf'|'image'|'screen-capture',
//     text?:   string,                 // for text/log/pdf (extracted client-side)
//     imageBase64?, mediaType?,        // for image/screen-capture
//     filename?,
//     os?: 'windows'|'mac',
//     allowCloudVision?: bool,         // user opted into cloud vision for this image
//     redactRegions?: [{x,y,w,h}],     // 0..1 fractions the USER painted out; masked before sending
//     consent?: { screenCapture?, cloudProcessing?, autoCapture?, ts? }
//   }
// →  { ok, blocked?, requiresConsent?, disclosure, dataFlow, diagnosis|null, fix|null,
//      redaction, confidence, confidenceLabel, abstain, honestFallback?, meta }
//
// 🔒 RULE 14: an image we cannot confidently read → honest abstain, never a made-up diagnosis.
// 🔒 PRIVACY: consent gate first; text/logs redacted BEFORE anything leaves; the vision model is
//    instructed not to echo secrets and its output is redacted again before use.
// 🔒 COST: Fable 5 is paid → cloud vision fires ONLY for images, only with consent, only when a
//    model is configured (ARIA_VISION_MODEL). The $0 offline KB is always the fallback.

import { diagnoseInput, redactPII } from './lib/vision-diagnose-core.mjs';
import { evaluateConsent, shouldCallCloudVision, dataFlow, buildDisclosure } from './lib/vision-consent.mjs';
import { scrubImageMetadata } from './lib/vision-image-scrub.mjs';
import { redactImageRegions } from './lib/vision-pixel-redact.mjs';
import { matchFix } from './lib/vision-fix-link.mjs';
import { RECIPES } from './aria-recipes-data.mjs';
// D4 — reuse the site's existing spend controls for the paid vision call (same as aria-chat.js).
// CJS interop: default-import the module object, then destructure (named CJS imports are flaky).
import breakerMod from './_circuit-breaker.js';
import retryMod from './_retry.js';
import rateMod from './_rate-limit.js';
const { withBreaker } = breakerMod;
const { fetchWithRetry } = retryMod;
const { checkRateLimit, hashKey } = rateMod;

// Cost guards for the paid image path (dead until ARIA_VISION_MODEL is set):
//   - per-IP throttle so an anonymous visitor can't loop paid calls
//   - hard cap on the base64 image size before we ever hit the wire
// Read from env per-request so operators can tune limits without a code change.
const VISION_IP_WINDOW_MS = 15 * 60 * 1000;
const visionIpLimit = () => Number(process.env.ARIA_VISION_IP_LIMIT || 6);        // calls / window / IP
const maxImageB64Bytes = () => Number(process.env.ARIA_VISION_MAX_B64 || 7_000_000); // ~5MB image

function clientIp(req) {
  const h = req.headers;
  return (h.get('x-nf-client-connection-ip') || h.get('client-ip') || h.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

const KB_URL = 'https://iisupp.net/assets/aria-kb-chunks.json';
let CHUNKS = null, CHUNKS_AT = 0;
async function loadChunks() {
  if (CHUNKS && (Date.now() - CHUNKS_AT) < 3600e3) return CHUNKS;
  const r = await fetch(KB_URL, { headers: { 'user-agent': 'aria-vision-diagnose/1.0' } });
  if (!r.ok) throw new Error(`KB fetch failed: ${r.status}`);
  const data = await r.json();
  CHUNKS = data.chunks || [];
  CHUNKS_AT = Date.now();
  return CHUNKS;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return resp(204, null);
  if (req.method !== 'POST') return resp(405, { ok: false, error: 'POST only' });

  let body;
  try { body = await req.json(); } catch { return resp(400, { ok: false, error: 'bad-json' }); }

  const surface = ['web', 'sentinel', 'forums'].includes(body.surface) ? body.surface : 'web';
  const kind = ['text', 'log', 'pdf', 'image', 'screen-capture'].includes(body.kind) ? body.kind : 'text';
  const os = body.os === 'mac' ? 'mac' : 'windows';
  const isImage = kind === 'image' || kind === 'screen-capture';

  // Is a real vision model configured on this deployment?
  const hasVisionModel = !!(process.env.ARIA_VISION_MODEL && process.env.ANTHROPIC_API_KEY);
  const willCallCloud = shouldCallCloudVision({ kind, allowCloudVision: !!body.allowCloudVision, hasVisionModel });

  // ---- Gate 1+2: consent + disclosure ----
  const gate = evaluateConsent({ surface, kind, willCallCloud, consent: body.consent || {} });
  if (gate.blocked) {
    return resp(200, {
      ok: true, blocked: true,
      requiresConsent: gate.requiresConsent,
      disclosure: gate.disclosure,
      dataFlow: gate.dataFlow,
      diagnosis: null,
      hint: 'Approve the items in requiresConsent, or type/paste the error text — it is matched on our own server against the offline KB and never sent to a third-party AI model.',
    });
  }

  // ---- Acquire the problem text ----
  let visionText = '';
  let visionUsed = false;
  let visionNote = null;
  let imageScrub = null;      // metadata pre-flight report for the image path (null for text/logs)
  let pixelRedaction = null;  // user-painted pixel redaction report (null when the user painted nothing)

  if (isImage) {
    if (willCallCloud) {
      // D4 — size cap: refuse oversized payloads BEFORE any paid call or work.
      const maxB64 = maxImageB64Bytes();
      const b64len = typeof body.imageBase64 === 'string' ? body.imageBase64.length : 0;
      if (!b64len || b64len > maxB64) {
        return resp(413, {
          ok: false, blocked: false, abstain: true, diagnosis: null,
          confidence: 0, confidenceLabel: 'abstain',
          reason: b64len ? 'image-too-large' : 'no-image',
          error: b64len ? `Image too large (max ~${Math.round(maxB64 / 1e6)}MB). Crop to just the error and retry.` : 'No image data.',
          dataFlow: dataFlow({ willCallCloud: false, kind }),
          honestFallback: honestFallback(os),
          meta: { surface, kind, visionUsed: false },
        });
      }
      // D4 — per-IP throttle so anonymous visitors can't loop the paid model.
      const rl = checkRateLimit({}, { key: hashKey('vision:' + clientIp(req)), limit: visionIpLimit(), windowMs: VISION_IP_WINDOW_MS });
      if (!rl.ok) {
        return resp(429, {
          ok: false, error: 'rate_limited', retry_after_sec: rl.retryAfterSec,
          abstain: true, diagnosis: null, honestFallback: honestFallback(os),
          meta: { surface, kind, visionUsed: false },
        });
      }
      // 🔒 PRIVACY PRE-FLIGHT (spec: redact obvious PII/secrets in images BEFORE any cloud call).
      // Embedded metadata — EXIF/GPS, device serial, owner name, IPTC, PNG text chunks — is
      // invisible to the user and routinely carries real PII, so it is stripped here, before the
      // bytes leave the machine. Pixels are NOT masked: the disclosure keeps saying so.
      // If we cannot parse the image well enough to pre-clean it, we do NOT send it (Rule 14:
      // refuse honestly rather than quietly ship an uncleaned image to a paid third-party model).
      const scrub = scrubImageMetadata(body.imageBase64, body.mediaType || 'image/png', redactPII);
      if (!scrub.ok) {
        return resp(200, {
          ok: true, blocked: false, abstain: true, diagnosis: null,
          confidence: 0, confidenceLabel: 'abstain',
          reason: 'image-not-prescrubbable',
          scrubReason: scrub.reason,
          disclosure: gate.disclosure,
          dataFlow: dataFlow({ willCallCloud: false, kind }),
          imageScrub: { ok: false, reason: scrub.reason, note: scrub.note },
          honestFallback: honestFallback(os),
          hint: 'Save the screenshot as PNG or JPEG and retry, or paste the error text — the offline knowledge base answers that for free.',
          meta: { surface, kind, visionUsed: false },
        });
      }
      imageScrub = {
        ok: true,
        format: scrub.format,
        removed: scrub.removed,
        piiFound: scrub.piiFound,
        bytesBefore: scrub.bytesBefore,
        bytesAfter: scrub.bytesAfter,
        note: scrub.note,
      };

      // 🔒 PRIVACY PRE-FLIGHT, PART 2 — PIXELS.
      // The metadata strip above cannot touch an email address that is visibly on screen. If the
      // user painted boxes over the sensitive areas, those pixels are destroyed in the file HERE,
      // before the paid call. Nothing is detected automatically — there is no OCR — so an image
      // with no painted regions still goes unredacted and every disclosure keeps saying so.
      // If the user ASKED for redaction and we cannot deliver it, we refuse: shipping the
      // unpainted original to a third-party model after being asked to mask it would be the
      // worst possible failure mode.
      let sendBase64 = scrub.base64;
      let sendMediaType = body.mediaType || 'image/png';
      if (Array.isArray(body.redactRegions) && body.redactRegions.length > 0) {
        const pr = redactImageRegions(scrub.base64, sendMediaType, body.redactRegions);
        if (!pr.ok) {
          return resp(200, {
            ok: true, blocked: false, abstain: true, diagnosis: null,
            confidence: 0, confidenceLabel: 'abstain',
            reason: 'pixel-redaction-failed',
            redactionReason: pr.reason,
            disclosure: gate.disclosure,
            dataFlow: dataFlow({ willCallCloud: false, kind }),
            imageScrub,
            pixelRedaction: { ok: false, reason: pr.reason, note: pr.note },
            honestFallback: honestFallback(os),
            hint: 'You asked for areas to be painted out and we could not do it, so nothing was sent. Re-save the screenshot as PNG and retry, or paste the error text — the offline knowledge base answers that for free.',
            meta: { surface, kind, visionUsed: false },
          });
        }
        sendBase64 = pr.base64;
        sendMediaType = pr.mediaType;
        pixelRedaction = {
          ok: true,
          regions: pr.regions,
          pixelsPainted: pr.pixelsPainted,
          percentPainted: pr.percentPainted,
          width: pr.width,
          height: pr.height,
          bytesBefore: pr.bytesBefore,
          bytesAfter: pr.bytesAfter,
          note: pr.note,
        };
      }

      try {
        visionText = await runVision({ imageBase64: sendBase64, mediaType: sendMediaType, hostBase: hostBase(req) });
        visionUsed = true;
      } catch (e) {
        // Cloud vision failed — do NOT fabricate. Fall through to honest abstain.
        visionNote = 'cloud-vision-failed';
        console.error('[aria-vision-diagnose] vision error:', e && e.message);
      }
    } else {
      // Image, but no cloud vision available/allowed → honest abstain (Rule 14).
      visionNote = hasVisionModel ? 'cloud-vision-not-authorized' : 'cloud-vision-not-configured';
    }
    if (!visionUsed) {
      return resp(200, {
        ok: true, blocked: false, abstain: true, diagnosis: null,
        confidence: 0, confidenceLabel: 'abstain',
        reason: visionNote,
        imageScrub,
        pixelRedaction,
        disclosure: gate.disclosure,
        dataFlow: dataFlow({ willCallCloud: false, kind }),
        honestFallback: honestFallback(os),
        meta: { surface, kind, visionUsed: false },
      });
    }
  }

  // ---- Redact + diagnose (shared $0 retriever) ----
  let chunks;
  try { chunks = await loadChunks(); }
  catch (e) { return resp(200, { ok: true, abstain: true, diagnosis: null, reason: 'kb-unavailable', honestFallback: honestFallback(os), meta: { error: e.message } }); }

  const d = diagnoseInput({
    kind,
    text: isImage ? '' : String(body.text || ''),
    visionText,
    filename: String(body.filename || ''),
    chunks,
  });

  const base = {
    ok: true, blocked: false,
    surface, kind, os,
    disclosure: buildDisclosure({ surface, kind, willCallCloud, isCapture: kind === 'screen-capture', pixelRedactedRegions: pixelRedaction && pixelRedaction.ok ? pixelRedaction.regions : 0 }),
    dataFlow: dataFlow({ willCallCloud, kind, pixelRedactedRegions: pixelRedaction && pixelRedaction.ok ? pixelRedaction.regions : 0 }),
    redaction: d.redaction,          // {found:[{type,count}], count} — shown to the user
    imageScrub,                      // what metadata was stripped before the image left (null for text)
    pixelRedaction,                  // what the USER painted out before it was sent (null if nothing)
    signals: d.signals,
    confidence: d.confidence,
    confidenceLabel: d.confidenceLabel,
    meta: { surface, kind, visionUsed, visionNote, kbCount: chunks.length },
  };

  if (!d.match) {
    // Honest abstain — closest guidance + open a discussion / escalate to IIS.
    return resp(200, { ...base, abstain: true, diagnosis: null, closest: d.closest || null, honestFallback: honestFallback(os) });
  }

  // Confident match → attach the diagnosis + the gated one-click fix.
  const issueForFix = d.article.title || d.article.slug.replace(/-/g, ' ');
  const fix = matchFix(issueForFix + ' ' + (d.signals.apps || []).join(' '), os, RECIPES);

  return resp(200, {
    ...base, abstain: false,
    diagnosis: {
      title: d.article.title,
      slug: d.article.slug,
      tier: d.article.tier,
      vertical: d.article.vertical,
      url: d.article.url,
      steps: d.excerpt,
    },
    fix: fix ? { ...fix, note: 'Executing runs through the gated Sentinel resolve flow (restore point · kill-switch · signed audit token · logged).' } : null,
    feedbackPrompt: 'Was this the right fix?',
  });
};

function hostBase(req) {
  try { return new URL(req.url).origin; } catch { return process.env.APP_URL || 'https://iisupp.net'; }
}

// Fire-and-forget spend log to the existing cost tracker (never blocks or fails the response).
function logVisionCost(model, usage, hostBase) {
  try {
    fetch(`${hostBase}/.netlify/functions/aria-cost-tracker`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'log', model, tokens_in: (usage && usage.input_tokens) || 0, tokens_out: (usage && usage.output_tokens) || 0 }),
    }).catch(() => {});
  } catch { /* never throws */ }
}

// ---- Fable 5 vision call (mirrors aria-chat's Anthropic pattern: breaker + retry + prompt-cache) ----
async function runVision({ imageBase64, mediaType, hostBase }) {
  if (!imageBase64) throw new Error('no image data');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ARIA_VISION_MODEL;           // operator sets the vision model they have
  if (!apiKey || !model) throw new Error('vision not configured');

  const system = [
    {
      type: 'text',
      text: 'You are ARIA\'s visual IT diagnostician. Describe ONLY the technical problem shown in the image ' +
            '(error text, dialog title, codes, app name, device/light state). Output 1-3 plain sentences. ' +
            'NEVER transcribe personal data, email addresses, usernames, IP/MAC addresses, license keys, tokens, ' +
            'passwords, or any secret you see — omit them. If the image shows no diagnosable IT problem, reply exactly: NO_CLEAR_PROBLEM.',
      cache_control: { type: 'ephemeral' },               // prompt-cache the system prompt (cost control)
    },
  ];
  const messages = [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
      { type: 'text', text: 'What IT problem is shown? Follow the redaction rules.' },
    ],
  }];

  // Breaker + bounded retry, same guardrails as aria-chat.js — an overloaded/erroring Anthropic
  // trips the breaker instead of hammering the paid endpoint.
  const r = await withBreaker('anthropic-vision', () => fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 400, system, messages }),
  }, { attempts: 3, baseDelayMs: 250, maxDelayMs: 1600 }), {
    failure_threshold: 3, cooldown_ms: 45 * 1000, request_timeout_ms: 28000,
  });
  if (!r.ok) throw new Error('vision http ' + r.status);
  const j = await r.json();
  // Log real spend to the existing tracker (fire-and-forget; env-gated path).
  logVisionCost(model, j.usage, hostBase || (process.env.APP_URL || 'https://iisupp.net'));
  const raw = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
  if (!raw || /^NO_CLEAR_PROBLEM/i.test(raw)) throw new Error('no-clear-problem');
  // Defense-in-depth: redact anything the model returned despite instructions.
  return redactPII(raw).redacted;
}

function honestFallback(os) {
  return {
    message: "I'm not confident enough to give you a fix from this — I won't guess.",
    options: [
      { label: 'Type the exact error text', action: 'type-error' },
      { label: 'Open a discussion in the community', action: 'open-discussion', href: '/forums' },
      { label: 'Escalate to IIS (a human will help)', action: 'escalate', href: '/aria?escalate=1' },
    ],
    os,
  };
}

function resp(status, obj) {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'content-type': 'application/json',
    'cache-control': 'no-store',
  };
  if (obj === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(obj), { status, headers });
}

export const config = { path: '/.netlify/functions/aria-vision-diagnose' };
