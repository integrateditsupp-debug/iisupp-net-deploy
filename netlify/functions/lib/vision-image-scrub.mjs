// vision-image-scrub.mjs — STAGE 2 privacy pre-flight for the paid cloud-vision path.
// ------------------------------------------------------------------------------------
// The spec requires: "redact obvious PII/secrets in images BEFORE any cloud call."
//
// HONEST SCOPE (Rule 14 — do not oversell this):
//   WHAT THIS DOES: strips embedded METADATA from the image bytes before they leave the
//     machine — EXIF (incl. GPS coordinates, camera/device serial, owner name), XMP, IPTC,
//     JPEG comments, PNG text chunks. This metadata routinely carries real PII and is invisible
//     to the user, so it is the highest-value thing we can actually remove without OCR.
//   WHAT THIS DOES NOT DO: mask PIXELS. An email address visible in a screenshot is still
//     visible to the vision model. The disclosure must keep saying the image is sent UNREDACTED.
//     Pixel-level masking stays a documented future item, not a claim.
//
// Zero dependencies, pure byte-walking, works in the Netlify function runtime.

const JPEG_DROP = {
  0xe1: 'EXIF/XMP (APP1 - can contain GPS, device serial, owner name)',
  0xed: 'IPTC/Photoshop (APP13 - can contain author, location, captions)',
  0xee: 'Adobe (APP14 - tooling fingerprint)',
  0xfe: 'JPEG comment (COM - free text, often a filename or path)',
};
const PNG_DROP = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

function sniffFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  return null;
}

// Strip JPEG APPn/COM metadata segments. Everything from SOS (0xFFDA) onward is entropy-coded
// image data and is copied through untouched.
function scrubJpeg(bytes) {
  const out = [];
  const removed = [];
  let text = '';
  let i = 0;

  out.push(bytes.subarray(0, 2)); // SOI
  i = 2;

  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xda) { out.push(bytes.subarray(i)); i = bytes.length; break; } // SOS -> pixels
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return { ok: false, reason: 'malformed-jpeg' };
    const seg = bytes.subarray(i, i + 2 + len);
    if (JPEG_DROP[marker]) {
      removed.push({ type: JPEG_DROP[marker], bytes: seg.length });
      text += ' ' + asciiOf(seg);
    } else {
      out.push(seg);
    }
    i += 2 + len;
  }
  if (removed.length === 0 && out.length === 1) return { ok: false, reason: 'malformed-jpeg' };
  return { ok: true, bytes: concat(out), removed, removedText: text.trim() };
}

// Strip PNG ancillary text/EXIF/time chunks. Chunk CRCs are per-chunk, so dropping whole chunks
// leaves the remaining stream valid - nothing has to be recomputed.
function scrubPng(bytes) {
  const out = [bytes.subarray(0, 8)];
  const removed = [];
  let text = '';
  let i = 8;

  while (i + 8 <= bytes.length) {
    const len = (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const total = 12 + len;
    if (len > bytes.length || i + total > bytes.length) return { ok: false, reason: 'malformed-png' };
    const chunk = bytes.subarray(i, i + total);
    if (PNG_DROP.has(type)) {
      removed.push({ type: 'PNG ' + type + ' chunk (embedded text/EXIF)', bytes: chunk.length });
      text += ' ' + asciiOf(chunk);
    } else {
      out.push(chunk);
    }
    i += total;
    if (type === 'IEND') break;
  }
  return { ok: true, bytes: concat(out), removed, removedText: text.trim() };
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf;
}

// Printable-ASCII view of a metadata blob, so we can honestly report whether what we removed
// actually looked like PII (rather than just asserting that it did).
function asciiOf(bytes) {
  let s = '';
  for (let n = 0; n < bytes.length; n++) {
    const c = bytes[n];
    s += (c >= 32 && c < 127) ? String.fromCharCode(c) : ' ';
  }
  return s;
}

export function scrubImageMetadata(base64, mediaType = '', inspectText = null) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    return { ok: false, reason: 'no-image', note: 'No image data to scrub.' };
  }
  let bytes;
  try {
    bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  } catch {
    return { ok: false, reason: 'undecodable', note: 'Image payload is not valid base64.' };
  }
  const format = sniffFormat(bytes);
  if (!format) {
    return {
      ok: false,
      reason: 'unsupported-format',
      note: 'We can only strip embedded metadata from PNG and JPEG (declared: ' + (mediaType || 'unknown') + '). '
          + 'Rather than send an image we cannot pre-clean, we stop and ask for a PNG/JPEG or the error text.',
    };
  }

  const res = format === 'jpeg' ? scrubJpeg(bytes) : scrubPng(bytes);
  if (!res.ok) {
    return { ok: false, reason: res.reason, note: 'Image structure could not be parsed, so it was not pre-cleaned and was not sent.' };
  }

  let piiFound = [];
  if (inspectText && res.removedText) {
    try { piiFound = (inspectText(res.removedText).found || []); } catch { piiFound = []; }
  }

  return {
    ok: true,
    base64: Buffer.from(res.bytes).toString('base64'),
    format,
    removed: res.removed,
    piiFound,
    bytesBefore: bytes.length,
    bytesAfter: res.bytes.length,
    note: res.removed.length
      ? 'Stripped ' + res.removed.length + ' metadata block(s) before the image left this machine. Pixels are unchanged and are still sent unredacted.'
      : 'No embedded metadata found. Pixels are unchanged and are still sent unredacted.',
  };
}

export default { scrubImageMetadata };
