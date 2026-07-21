// tests/vision-pixel-redact.test.mjs — STAGE 2 privacy pre-flight, part 2 (PIXEL redaction).
// Rule 14 is the point of this file: prove the masking is REAL, prove the refusals are real,
// and prove we never claim masking we did not perform.

import test from 'node:test';
import assert from 'node:assert/strict';
import { redactImageRegions, decodePng, encodePng } from '../netlify/functions/lib/vision-pixel-redact.mjs';

const b64 = (buf) => Buffer.from(buf).toString('base64');
const bytesOf = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

// A flat test image. colorType 2 = RGB, 6 = RGBA.
function makePng({ w = 40, h = 20, colorType = 2, fill = 200 } = {}) {
  const channels = colorType === 6 ? 4 : 3;
  const raw = Buffer.alloc(w * h * channels, fill);
  if (channels === 4) for (let i = 3; i < raw.length; i += 4) raw[i] = 255;
  return encodePng({ width: w, height: h, colorType, channels, raw });
}
const px = (dec, x, y) => {
  const o = (y * dec.width + x) * dec.channels;
  return Array.from(dec.raw.subarray(o, o + dec.channels));
};

test('[1] a painted region is really black in the output bytes, and the rest is untouched', () => {
  const r = redactImageRegions(b64(makePng()), 'image/png', [{ x: 0.25, y: 0.25, w: 0.25, h: 0.25 }]);
  assert.equal(r.ok, true);
  assert.equal(r.regions, 1);
  assert.equal(r.pixelsPainted, 50, '10x5 px of a 40x20 image');

  const dec = decodePng(bytesOf(r.base64));
  assert.equal(dec.ok, true);
  assert.deepEqual(px(dec, 12, 7), [0, 0, 0], 'inside the box is black');
  assert.deepEqual(px(dec, 2, 2), [200, 200, 200], 'outside the box is the original colour');
  assert.deepEqual(px(dec, 39, 19), [200, 200, 200], 'the far corner is untouched');
});

test('[2] the covered pixels are DESTROYED, not overlaid — nothing recovers them', () => {
  const src = makePng();
  const r = redactImageRegions(b64(src), 'image/png', [{ x: 0, y: 0, w: 1, h: 1 }]);
  assert.equal(r.ok, true);
  const dec = decodePng(bytesOf(r.base64));
  const anyOriginal = dec.raw.some((v) => v === 200);
  assert.equal(anyOriginal, false, 'a full-image redaction leaves no original pixel value anywhere');
  assert.equal(r.pixelsPainted, 40 * 20);
  assert.equal(r.percentPainted, 100);
});

test('[3] RGBA is painted opaque black, not transparent', () => {
  const r = redactImageRegions(b64(makePng({ colorType: 6 })), 'image/png', [{ x: 0, y: 0, w: 0.5, h: 0.5 }]);
  assert.equal(r.ok, true);
  const dec = decodePng(bytesOf(r.base64));
  assert.deepEqual(px(dec, 1, 1), [0, 0, 0, 255], 'alpha stays opaque so the box is visibly a box');
});

test('[4] a JPEG is REFUSED for pixel redaction and no sendable bytes come back', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 3)]);
  const r = redactImageRegions(b64(jpeg), 'image/jpeg', [{ x: 0, y: 0, w: 1, h: 1 }]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'format-not-pixel-redactable');
  assert.ok(!('base64' in r), 'a refusal never hands back bytes a caller could ship anyway');
  assert.match(r.note, /PNG/i, 'the refusal says what to do instead');
});

test('[5] no regions / unusable regions are refusals, never a silent pass-through', () => {
  const png = b64(makePng());
  assert.equal(redactImageRegions(png, 'image/png', []).reason, 'no-regions');
  assert.equal(redactImageRegions(png, 'image/png').reason, 'no-regions');
  assert.equal(redactImageRegions('', 'image/png', [{ x: 0, y: 0, w: 1, h: 1 }]).reason, 'no-image');

  // Boxes that cover nothing must NOT come back as a successful "redaction".
  const zero = redactImageRegions(png, 'image/png', [{ x: 0.5, y: 0.5, w: 0, h: 0.5 }]);
  assert.equal(zero.ok, false);
  assert.equal(zero.reason, 'no-usable-regions');
  assert.ok(!('base64' in zero));

  const junk = redactImageRegions(png, 'image/png', [{ x: 'a', y: null, w: NaN, h: 1 }]);
  assert.equal(junk.ok, false, 'garbage coordinates are refused, not guessed at');
});

test('[6] out-of-range boxes are clamped to the image instead of crashing', () => {
  const r = redactImageRegions(b64(makePng()), 'image/png', [{ x: -5, y: -5, w: 99, h: 99 }]);
  assert.equal(r.ok, true);
  assert.equal(r.pixelsPainted, 40 * 20, 'clamped to exactly the image, no more');
});

test('[7] a PNG we cannot safely paint is refused, not corrupted', () => {
  // Palette (colour type 3) — painting it means rewriting the palette; we decline instead.
  const png = makePng();
  const bad = Buffer.from(png);
  bad[8 + 8 + 9] = 3;                       // IHDR colour type byte -> palette
  const r = redactImageRegions(b64(bad), 'image/png', [{ x: 0, y: 0, w: 1, h: 1 }]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unsupported-png-colour-type');
  assert.ok(!('base64' in r));

  const truncated = redactImageRegions(b64(png.subarray(0, 20)), 'image/png', [{ x: 0, y: 0, w: 1, h: 1 }]);
  assert.equal(truncated.ok, false, 'a malformed PNG is refused, never half-sent');
});

test('[8] Rule 14 — the note claims exactly what happened, no automatic detection is implied', () => {
  const r = redactImageRegions(b64(makePng()), 'image/png', [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }]);
  assert.match(r.note, /Painted 1 region/, 'the count is the real count');
  assert.match(r.note, /still sent unredacted/i, 'the unpainted remainder is still declared unredacted');
  assert.match(r.note, /Nothing was detected automatically/i, 'we never imply OCR/auto-PII we did not build');
  assert.ok(!/all (PII|secrets|personal data) (was|were) removed/i.test(r.note), 'no blanket "PII removed" claim');
});

test('[9] the handler paints BEFORE the paid call and refuses if it cannot', async () => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('../netlify/functions/aria-vision-diagnose.mjs', import.meta.url), 'utf8');
  const redactAt = src.indexOf('redactImageRegions(scrub.base64');
  const visionAt = src.indexOf('await runVision(');
  assert.ok(redactAt > 0 && visionAt > 0, 'both the pixel redaction and the vision call exist');
  assert.ok(redactAt < visionAt, 'the paint runs BEFORE the paid cloud call');
  assert.ok(/imageBase64:\s*sendBase64/.test(src), 'the painted buffer is what gets sent');
  assert.ok(/reason: 'pixel-redaction-failed'/.test(src), 'a failed paint aborts with an honest reason');
  // The abort must happen without ever reaching the paid call.
  const failAt = src.indexOf("reason: 'pixel-redaction-failed'");
  assert.ok(failAt < visionAt, 'the refusal returns before the paid call');
});

test('[10] disclosure + dataFlow tell the truth in BOTH states', async () => {
  const { buildDisclosure, dataFlow } = await import('../netlify/functions/lib/vision-consent.mjs');

  const none = buildDisclosure({ surface: 'web', kind: 'image', willCallCloud: true, isCapture: false });
  assert.match(none, /UNREDACTED/, 'painting nothing still says the image goes unredacted');
  assert.ok(!/painted out/i.test(none), 'we do not mention redaction that did not happen');
  assert.equal(dataFlow({ willCallCloud: true, kind: 'image' }).pixelRedaction.startsWith('none'), true);

  const painted = buildDisclosure({ surface: 'web', kind: 'image', willCallCloud: true, isCapture: false, pixelRedactedRegions: 2 });
  assert.match(painted, /2 region\(s\) you painted out are destroyed/, 'the real count is disclosed');
  assert.match(painted, /UNREDACTED/, 'the UNPAINTED remainder is still declared unredacted — no soft-pedalling');
  const f = dataFlow({ willCallCloud: true, kind: 'image', pixelRedactedRegions: 2 });
  assert.match(f.sends, /UNREDACTED/i);
  assert.match(f.pixelRedaction, /painted to solid black/i);
});

test('[11] the web widget actually lets the user paint, and never oversells it', async () => {
  const fs = await import('node:fs/promises');
  const w = await fs.readFile(new URL('../assets/aria-vision-diagnose.js', import.meta.url), 'utf8');

  // The tool exists and is wired to the request.
  assert.ok(/pointerdown/.test(w) && /pointerup/.test(w), 'the user can drag a box');
  assert.ok(/redactRegions:\s*sendRegions/.test(w), 'the painted regions are sent to the server');
  assert.ok(/toDataURL\('image\/png'\)/.test(w), 'the canvas is flattened in the browser so the original never leaves');
  assert.ok(/Undo last box/.test(w) && /Clear boxes/.test(w), 'a mis-drawn box can be undone');

  // Rule 14 wording: the consent copy must still admit the unpainted remainder goes unredacted,
  // and must not imply anything is detected for the user.
  assert.ok(/paint over is sent <strong>unredacted<\/strong>/.test(w), 'the consent dialog still says the unpainted remainder goes unredacted');
  assert.ok(/nothing is found or masked automatically, there is no OCR/.test(w), 'no implied auto-detection');
  assert.ok(/Nothing painted out yet/.test(w), 'the zero state says plainly that the whole image will be sent');

  // The receipt only claims a redaction the SERVER confirmed.
  assert.ok(/res\.pixelRedaction && res\.pixelRedaction\.ok \? res\.pixelRedaction : null/.test(w),
    'the painted-area receipt is real-or-silent, never asserted client-side');
});
