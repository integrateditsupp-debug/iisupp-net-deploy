// vision-image-scrub.test.mjs — STAGE 2 privacy pre-flight gate.
// Proves the claim we make in the disclosure is literally true: embedded metadata is REMOVED
// from the bytes before any cloud call, the visible image data survives, and an image we cannot
// pre-clean is REFUSED rather than quietly sent to a paid third-party model (Rule 14).
import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubImageMetadata } from '../netlify/functions/lib/vision-image-scrub.mjs';
import { redactPII } from '../netlify/functions/lib/vision-diagnose-core.mjs';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'latin1');
  const d = Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}
// Minimal-but-structurally-real PNG carrying a tEXt chunk with a real-looking email + an eXIf blob.
function makePng({ withMetadata = true } = {}) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
  const idat = pngChunk('IDAT', Buffer.from([0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  const meta = withMetadata
    ? [pngChunk('tEXt', Buffer.from('Author\0ahmad.wasee@example.com', 'latin1')),
       pngChunk('eXIf', Buffer.from('GPSLatitude 43.6532 GPSLongitude -79.3832', 'latin1'))]
    : [];
  return Buffer.concat([sig, ihdr, ...meta, idat, iend]);
}
// Minimal JPEG: SOI + APP1(EXIF w/ owner name) + COM + SOS + scan bytes + EOI.
function makeJpeg() {
  const seg = (marker, payload) => {
    const p = Buffer.from(payload, 'latin1');
    const h = Buffer.alloc(4);
    h[0] = 0xff; h[1] = marker; h.writeUInt16BE(p.length + 2, 2);
    return Buffer.concat([h, p]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from([0x00, 0x10]), Buffer.from('JFIF\0\0\0\0\0\0', 'latin1'),
    seg(0xe1, 'Exif\0\0owner=Ahmad Wasee GPS 43.65,-79.38'),
    seg(0xfe, 'C:\\Users\\ahmad\\Desktop\\error.jpg'),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
    Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]),
  ]);
}
const b64 = (buf) => buf.toString('base64');

test('[1] PNG: embedded tEXt/eXIf metadata is removed before any cloud call', () => {
  const r = scrubImageMetadata(b64(makePng()), 'image/png', redactPII);
  assert.equal(r.ok, true);
  assert.equal(r.format, 'png');
  assert.ok(r.removed.length >= 2, 'both metadata chunks reported as removed');
  assert.ok(r.bytesAfter < r.bytesBefore, 'the scrubbed file is smaller than the original');
  const out = Buffer.from(r.base64, 'base64').toString('latin1');
  assert.ok(!out.includes('ahmad.wasee@example.com'), 'the email in the metadata is GONE from the bytes we would send');
  assert.ok(!out.includes('GPSLatitude'), 'GPS metadata is GONE from the bytes we would send');
});

test('[2] the surviving bytes are still a valid PNG with its image data intact', () => {
  const r = scrubImageMetadata(b64(makePng()), 'image/png', redactPII);
  const out = Buffer.from(r.base64, 'base64');
  assert.deepEqual([...out.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG signature preserved');
  const s = out.toString('latin1');
  assert.ok(s.includes('IHDR') && s.includes('IDAT') && s.includes('IEND'), 'header, pixel data and end chunk all survive');
});

test('[3] the removed metadata is reported honestly as containing PII', () => {
  const r = scrubImageMetadata(b64(makePng()), 'image/png', redactPII);
  assert.ok(Array.isArray(r.piiFound), 'piiFound is always an array');
  assert.ok(r.piiFound.some((f) => /EMAIL/i.test(f.type)), 'the email hidden in the metadata is named in the report');
});

test('[4] JPEG: EXIF (APP1) and comment (COM) segments are stripped, scan data kept', () => {
  const r = scrubImageMetadata(b64(makeJpeg()), 'image/jpeg', redactPII);
  assert.equal(r.ok, true);
  assert.equal(r.format, 'jpeg');
  const out = Buffer.from(r.base64, 'base64').toString('latin1');
  assert.ok(!out.includes('owner=Ahmad Wasee'), 'owner name in EXIF is gone');
  assert.ok(!out.includes('C:\\Users\\ahmad'), 'local file path in the JPEG comment is gone');
  assert.ok(out.includes('JFIF'), 'the ordinary JFIF header is left alone');
  assert.ok(out.charCodeAt(out.length - 2) === 0xff && out.charCodeAt(out.length - 1) === 0xd9, 'image data through EOI is untouched');
});

test('[5] a clean image is passed through, and we do not claim we removed something', () => {
  const r = scrubImageMetadata(b64(makePng({ withMetadata: false })), 'image/png', redactPII);
  assert.equal(r.ok, true);
  assert.equal(r.removed.length, 0);
  assert.match(r.note, /No embedded metadata found/i);
  assert.equal(r.piiFound.length, 0, 'nothing removed means nothing is claimed found');
});

test('[6] an image we cannot pre-clean is REFUSED, not silently sent', () => {
  const gif = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(16, 7)]);
  const r = scrubImageMetadata(b64(gif), 'image/gif', redactPII);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unsupported-format');
  assert.ok(!('base64' in r), 'a refusal never hands back bytes that could be sent anyway');
  const junk = scrubImageMetadata('AAAA', 'image/png', redactPII);
  assert.equal(junk.ok, false, 'non-image junk is refused too');
  const empty = scrubImageMetadata('', 'image/png', redactPII);
  assert.equal(empty.reason, 'no-image');
});

test('[7] the note never claims pixels were masked (Rule 14 — no overselling)', () => {
  const r = scrubImageMetadata(b64(makePng()), 'image/png', redactPII);
  assert.ok(/still sent unredacted/i.test(r.note), 'the note repeats that pixels leave unredacted');
  assert.ok(!/pixels? (are|were) (masked|redacted|blurred)/i.test(r.note), 'we never claim pixel masking we did not do');
});

test('[8] the handler wires the scrub in ahead of the paid call', async () => {
  const src = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../netlify/functions/aria-vision-diagnose.mjs', import.meta.url), 'utf8'));
  const scrubAt = src.indexOf('scrubImageMetadata(body.imageBase64');
  const visionAt = src.indexOf('await runVision(');
  assert.ok(scrubAt > 0 && visionAt > 0, 'both the scrub and the vision call exist');
  assert.ok(scrubAt < visionAt, 'the scrub runs BEFORE the paid cloud call');
  // The bytes handed to the paid call are the pre-flighted ones, never `body.imageBase64`.
  // (They now travel via `sendBase64`, which is seeded from the scrub and may then be painted.)
  assert.ok(/let sendBase64 = scrub\.base64/.test(src), 'the send buffer is seeded from the SCRUBBED bytes, not the original');
  assert.ok(/imageBase64:\s*sendBase64/.test(src), 'the pre-flighted bytes are what get sent');
  assert.ok(!/imageBase64:\s*body\.imageBase64/.test(src), 'the raw uploaded bytes are never sent to the paid model');
  assert.ok(/image-not-prescrubbable/.test(src), 'an unscrubbable image aborts with an honest reason');
});

test('[9] the disclosure tells the user about the strip without softening the pixel truth', async () => {
  const { buildDisclosure, dataFlow } = await import('../netlify/functions/lib/vision-consent.mjs');
  const d = buildDisclosure({ surface: 'web', kind: 'image', willCallCloud: true, isCapture: false });
  assert.match(d, /UNREDACTED/, 'still says the image itself goes unredacted');
  assert.match(d, /metadata/i, 'now also states the metadata strip');
  const f = dataFlow({ willCallCloud: true, kind: 'image' });
  assert.match(f.sends, /UNREDACTED/i);
  assert.match(f.preCleaned, /EXIF/i);
});
