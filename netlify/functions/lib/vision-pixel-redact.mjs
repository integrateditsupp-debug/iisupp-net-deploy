// vision-pixel-redact.mjs — STAGE 2 privacy pre-flight, part 2: actual PIXEL redaction.
// -----------------------------------------------------------------------------------
// The spec requires: "redact obvious PII/secrets in images BEFORE any cloud call."
// `vision-image-scrub.mjs` closed the METADATA half of that. This closes the PIXEL half.
//
// HONEST SCOPE (Rule 14 — read this before writing any marketing copy):
//   WHAT THIS DOES: takes regions the USER chose (drag a box over the email address, the
//     licence key, the customer name) and paints those pixels OPAQUE BLACK inside the actual
//     image bytes, before the file is sent anywhere. The covered pixels are destroyed, not
//     covered by an overlay — re-decoding the output cannot recover them.
//   WHAT THIS DOES NOT DO: find PII on its own. There is no OCR here. Nothing is detected
//     automatically. If the user paints nothing, nothing is masked, and every disclosure must
//     keep saying the image is sent UNREDACTED. "Automatic pixel PII detection" remains an
//     unbuilt, unclaimed future item.
//
// Zero dependencies (node:zlib is built in). PNG only — see `format-not-pixel-redactable`.

import zlib from 'node:zlib';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// Channels per pixel for the PNG colour types we can safely touch.
// 3 (palette) is deliberately absent: painting a palette image means rewriting the palette or
// re-quantising, and a wrong guess would silently corrupt the picture. We refuse instead.
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function isPng(bytes) {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return false;
  return true;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// decodePng → { ok, width, height, colorType, channels, raw } where `raw` is unfiltered,
// 8-bit, non-interlaced pixel data (height * width * channels bytes).
export function decodePng(bytes) {
  if (!isPng(bytes)) return { ok: false, reason: 'not-png' };

  let ihdr = null;
  const idat = [];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    if (len > bytes.length || i + 12 + len > bytes.length) return { ok: false, reason: 'malformed-png' };
    const data = bytes.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      if (len < 13) return { ok: false, reason: 'malformed-png' };
      ihdr = {
        width: ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0,
        height: ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0,
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    i += 12 + len;
  }

  if (!ihdr) return { ok: false, reason: 'malformed-png' };
  if (!ihdr.width || !ihdr.height) return { ok: false, reason: 'malformed-png' };
  if (ihdr.bitDepth !== 8) return { ok: false, reason: 'unsupported-png-bit-depth' };
  if (ihdr.interlace !== 0) return { ok: false, reason: 'unsupported-png-interlaced' };
  const channels = CHANNELS[ihdr.colorType];
  if (!channels) return { ok: false, reason: 'unsupported-png-colour-type' };
  if (!idat.length) return { ok: false, reason: 'malformed-png' };

  let inflated;
  try { inflated = zlib.inflateSync(Buffer.concat(idat)); }
  catch { return { ok: false, reason: 'malformed-png' }; }

  const { width, height } = ihdr;
  const bpp = channels;
  const stride = width * bpp;
  if (inflated.length < height * (stride + 1)) return { ok: false, reason: 'malformed-png' };

  const raw = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const ft = inflated[pos++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const cur = inflated[pos + x];
      const a = x >= bpp ? raw[rowStart + x - bpp] : 0;
      const b = y > 0 ? raw[prevStart + x] : 0;
      const c = (x >= bpp && y > 0) ? raw[prevStart + x - bpp] : 0;
      let v;
      switch (ft) {
        case 0: v = cur; break;
        case 1: v = cur + a; break;
        case 2: v = cur + b; break;
        case 3: v = cur + ((a + b) >> 1); break;
        case 4: v = cur + paeth(a, b, c); break;
        default: return { ok: false, reason: 'malformed-png' };
      }
      raw[rowStart + x] = v & 0xff;
    }
    pos += stride;
  }

  return { ok: true, width, height, colorType: ihdr.colorType, channels, raw };
}

// encodePng → minimal, valid PNG from unfiltered pixel data. Filter type 0 (None) on every row:
// larger than an optimised encoder, correct, and dependency-free. Re-encoding also means every
// ancillary chunk (text, EXIF, timestamps) is dropped by construction.
export function encodePng({ width, height, colorType, channels, raw }) {
  const stride = width * channels;
  const withFilters = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    withFilters[y * (stride + 1)] = 0;
    raw.copy(withFilters, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from(PNG_SIG),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(withFilters, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Regions arrive as FRACTIONS of the image (0..1) so the browser can send what the user drew
// without knowing the final pixel dimensions. Anything non-finite or zero-area is dropped —
// and if that leaves nothing, the caller is told, rather than being handed an untouched image
// that looks like it was redacted.
function normaliseRegions(regions, width, height) {
  if (!Array.isArray(regions)) return { ok: false, reason: 'invalid-regions' };
  const out = [];
  for (const r of regions) {
    if (!r || typeof r !== 'object') continue;
    const nums = [r.x, r.y, r.w, r.h].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) continue;
    let [fx, fy, fw, fh] = nums;
    if (fw <= 0 || fh <= 0) continue;
    let x0 = Math.round(Math.min(Math.max(fx, 0), 1) * width);
    let y0 = Math.round(Math.min(Math.max(fy, 0), 1) * height);
    let x1 = Math.round(Math.min(Math.max(fx + fw, 0), 1) * width);
    let y1 = Math.round(Math.min(Math.max(fy + fh, 0), 1) * height);
    x0 = Math.min(x0, width); y0 = Math.min(y0, height);
    x1 = Math.min(x1, width); y1 = Math.min(y1, height);
    if (x1 <= x0 || y1 <= y0) continue;
    out.push({ x0, y0, x1, y1 });
  }
  if (!out.length) return { ok: false, reason: 'no-usable-regions' };
  return { ok: true, regions: out };
}

function paint(raw, width, channels, colorType, regions) {
  let painted = 0;
  const hasAlpha = colorType === 4 || colorType === 6;
  for (const { x0, y0, x1, y1 } of regions) {
    for (let y = y0; y < y1; y++) {
      let o = (y * width + x0) * channels;
      for (let x = x0; x < x1; x++) {
        for (let c = 0; c < channels; c++) raw[o + c] = 0;      // opaque black
        if (hasAlpha) raw[o + channels - 1] = 255;              // keep it visible, not transparent
        o += channels;
        painted++;
      }
    }
  }
  return painted;
}

// redactImageRegions — the only entry point the handler should use.
// Returns { ok:true, base64, ... } or { ok:false, reason, note } and NEVER hands back sendable
// bytes on a refusal: a caller that asked for redaction must not accidentally ship the original.
export function redactImageRegions(base64, mediaType = '', regions = []) {
  if (typeof base64 !== 'string' || base64.length === 0) {
    return { ok: false, reason: 'no-image', note: 'No image data to redact.' };
  }
  if (!Array.isArray(regions) || regions.length === 0) {
    return { ok: false, reason: 'no-regions', note: 'No redaction regions were supplied, so nothing was painted out.' };
  }

  let bytes;
  try { bytes = Uint8Array.from(Buffer.from(base64, 'base64')); }
  catch { return { ok: false, reason: 'undecodable', note: 'Image payload is not valid base64.' }; }

  if (!isPng(bytes)) {
    return {
      ok: false,
      reason: 'format-not-pixel-redactable',
      note: 'Pixel redaction is PNG-only (declared: ' + (mediaType || 'unknown') + '). A JPEG cannot be painted '
          + 'without a full re-encode we do not do here. Re-save the screenshot as PNG, or send it without '
          + 'redaction knowing it goes unredacted, or type the error text instead.',
    };
  }

  const dec = decodePng(bytes);
  if (!dec.ok) {
    return { ok: false, reason: dec.reason, note: 'This PNG could not be decoded well enough to paint over it, so it was not redacted and was not sent.' };
  }

  const norm = normaliseRegions(regions, dec.width, dec.height);
  if (!norm.ok) {
    return { ok: false, reason: norm.reason, note: 'The redaction boxes did not cover any pixels of this image, so nothing was painted out.' };
  }

  const painted = paint(dec.raw, dec.width, dec.channels, dec.colorType, norm.regions);
  let outBytes;
  try { outBytes = encodePng(dec); }
  catch { return { ok: false, reason: 'encode-failed', note: 'The redacted image could not be re-encoded, so nothing was sent.' }; }

  const pct = Math.round((painted / (dec.width * dec.height)) * 1000) / 10;
  return {
    ok: true,
    base64: Buffer.from(outBytes).toString('base64'),
    mediaType: 'image/png',
    width: dec.width,
    height: dec.height,
    regions: norm.regions.length,
    pixelsPainted: painted,
    percentPainted: pct,
    bytesBefore: bytes.length,
    bytesAfter: outBytes.length,
    note: 'Painted ' + norm.regions.length + ' region(s) — ' + painted + ' pixels (' + pct + '% of the image) — '
        + 'to solid black in the file itself before it left this machine. Those pixels are gone, not covered. '
        + 'The rest of the image is unchanged and is still sent unredacted. Nothing was detected automatically: '
        + 'only the areas you marked were painted.',
  };
}

export default { redactImageRegions, decodePng, encodePng };
