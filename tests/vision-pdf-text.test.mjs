// tests/vision-pdf-text.test.mjs — STAGE 2: PDF is a first-class input, honestly.
// The spec says "image/log/PDF". Images and logs shipped; a PDF hit "file type isn't supported".
// This suite proves the local extractor actually reads real PDF bytes, that the raw PDF never
// leaves the device, and — the Rule 14 half — that an unreadable PDF produces an honest refusal
// instead of garbage dressed up as the user's error.

import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const PDF = require('../assets/aria-pdf-text.js');

// ---------------------------------------------------------------------------------------
// A minimal but REAL PDF writer, so the tests run against bytes a viewer would accept —
// not against a mock of our own parser.
// ---------------------------------------------------------------------------------------
function buildPdf({ content, compress = false, extraDict = '', encrypt = false, header = '%PDF-1.7' } = {}) {
  const streamBytes = compress ? zlib.deflateSync(Buffer.from(content, 'latin1')) : Buffer.from(content, 'latin1');
  const dict = '<< /Length ' + streamBytes.length + (compress ? ' /Filter /FlateDecode' : '') + extraDict + ' >>';
  const parts = [];
  parts.push(Buffer.from(header + '\n%\xE2\xE3\xCF\xD3\n', 'latin1'));
  parts.push(Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'latin1'));
  parts.push(Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 'latin1'));
  parts.push(Buffer.from('3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n', 'latin1'));
  parts.push(Buffer.from('4 0 obj\n' + dict + '\nstream\n', 'latin1'));
  parts.push(streamBytes);
  parts.push(Buffer.from('\nendstream\nendobj\n', 'latin1'));
  if (encrypt) parts.push(Buffer.from('5 0 obj\n<< /Filter /Standard /V 2 /R 3 >>\nendobj\ntrailer\n<< /Encrypt 5 0 R /Root 1 0 R >>\n', 'latin1'));
  parts.push(Buffer.from('trailer\n<< /Root 1 0 R /Size 5 >>\n%%EOF\n', 'latin1'));
  return new Uint8Array(Buffer.concat(parts));
}

const page = (lines) =>
  'BT /F1 12 Tf 72 720 Td\n' + lines.map((l) => '(' + l.replace(/([()\\])/g, '\\$1') + ') Tj T*\n').join('') + 'ET\n';

// ---------------------------------------------------------------------------------------

test('[1] an UNCOMPRESSED PDF gives back the exact error text a technician would act on', async () => {
  const bytes = buildPdf({ content: page(['Windows cannot connect to the printer', 'Operation failed with error 0x0000011b']) });
  const r = await PDF.extractText(bytes);
  assert.equal(r.ok, true, r.reason || '');
  assert.match(r.text, /Windows cannot connect to the printer/);
  assert.match(r.text, /0x0000011b/);
  assert.ok(r.chars > 20);
  assert.equal(r.truncated, false);
});

test('[2] a FLATE-COMPRESSED PDF — what every real exporter writes — is inflated and read', async () => {
  const bytes = buildPdf({
    compress: true,
    content: page(['Event ID 7031: The Print Spooler service terminated unexpectedly', 'It has done this 4 time(s).']),
  });
  const r = await PDF.extractText(bytes);
  assert.equal(r.ok, true, r.reason || '');
  assert.match(r.text, /Event ID 7031/);
  assert.match(r.text, /Print Spooler service terminated unexpectedly/);
  assert.match(r.text, /4 time\(s\)/, 'escaped parentheses survive the literal-string reader');
});

test('[3] TJ arrays, hex strings and the quote operators all decode', async () => {
  const content =
    'BT /F1 11 Tf 50 700 Td\n' +
    '[(Outlook ) -250 (disconnected) -250 (from ) -250 (Exchange)] TJ\n' +
    'T* <4552524F52203078383030343031304  6> Tj\n' +
    "T* (Retry the connection) '\n" +
    'ET\n';
  const r = await PDF.extractText(buildPdf({ content }));
  assert.equal(r.ok, true, r.reason || '');
  assert.match(r.text, /Outlook disconnected from Exchange/, 'TJ parts are joined in order');
  assert.match(r.text, /ERROR 0x8004010/, 'hex strings decode to the same characters a viewer shows');
  assert.match(r.text, /Retry the connection/, "the ' operator shows text too");
});

test('[4] UTF-16BE text (BOM-flagged) decodes instead of coming back as byte soup', async () => {
  const utf16 = Buffer.concat([
    Buffer.from([0xFE, 0xFF]),
    Buffer.from('Le service ne demarre pas', 'utf16le').swap16(),
  ]);
  const esc = [...utf16].map((b) => '\\' + b.toString(8).padStart(3, '0')).join('');
  const r = await PDF.extractText(buildPdf({ content: 'BT /F1 12 Tf 72 700 Td (' + esc + ') Tj ET\n' }));
  assert.equal(r.ok, true, r.reason || '');
  assert.match(r.text, /Le service ne demarre pas/);
});

// ------------------------------- the Rule 14 half -------------------------------

test('[5] a SCANNED PDF (image only, no text layer) is REFUSED, not guessed at', async () => {
  const bytes = buildPdf({
    compress: true,
    extraDict: ' /Subtype /Image /Width 800 /Height 600',
    content: '\x00\x01\x02'.repeat(400),
  });
  const r = await PDF.extractText(bytes);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-text-layer');
  assert.equal(r.text, '', 'a refusal hands back nothing a caller could submit anyway');
  assert.match(r.note, /Screenshot the page/, 'the user is told what to do instead');
});

test('[6] an ENCRYPTED PDF is refused before any parsing is attempted', async () => {
  const r = await PDF.extractText(buildPdf({ content: page(['secret']), encrypt: true }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'encrypted-pdf');
  assert.equal(r.text, '');
});

test('[7] an unsupported filter (LZW/DCT/JBIG2) says so — it does not silently return nothing useful', async () => {
  const r = await PDF.extractText(buildPdf({ content: 'xxxx'.repeat(50), extraDict: ' /Filter /LZWDecode' }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unsupported-pdf-encoding');
});

test('[8] text recovered as unmappable byte soup FAILS the quality bar rather than being shipped', async () => {
  // A custom-encoded font maps glyph ids, not characters: the strings decode to control bytes.
  const junk = Array.from({ length: 200 }, (_, i) => '\\' + ((i % 26) + 1).toString(8).padStart(3, '0')).join('');
  const r = await PDF.extractText(buildPdf({ content: 'BT /F1 12 Tf 72 700 Td (' + junk + ') Tj ET\n' }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'text-not-recoverable');
  assert.equal(r.text, '', 'nothing unreliable is handed to the diagnoser');
});

test('[9] a non-PDF, an empty read and an oversized file each fail closed', async () => {
  const notPdf = await PDF.extractText(new Uint8Array(Buffer.from('PK\x03\x04 this is a zip')));
  assert.equal(notPdf.ok, false);
  assert.equal(notPdf.reason, 'not-a-pdf');

  const nothing = await PDF.extractText(null);
  assert.equal(nothing.ok, false);
  assert.equal(nothing.reason, 'no-data');

  const huge = new Uint8Array(13 * 1024 * 1024);
  huge.set(Buffer.from('%PDF-1.7'), 0);
  const big = await PDF.extractText(huge);
  assert.equal(big.ok, false);
  assert.equal(big.reason, 'pdf-too-large');
  assert.match(big.note, /12 MB/);
});

test('[10] a truncated / xref-less PDF still yields its text (real files are often damaged)', async () => {
  const full = buildPdf({ compress: true, content: page(['Disk read error occurred', 'Press Ctrl+Alt+Del to restart']) });
  const cut = full.subarray(0, full.length - 40);   // trailer and %%EOF gone
  const r = await PDF.extractText(cut);
  assert.equal(r.ok, true, r.reason || '');
  assert.match(r.text, /Disk read error occurred/);
});

test('[11] a stream we cannot inflate is skipped, never emitted as pseudo-text', async () => {
  const good = buildPdf({ compress: true, content: page(['DNS_PROBE_FINISHED_NO_INTERNET']) });
  // Splice a second object whose /FlateDecode payload is not valid deflate at all.
  const broken = Buffer.from('9 0 obj\n<< /Length 12 /Filter /FlateDecode >>\nstream\nQQQQQQQQQQQQ\nendstream\nendobj\n', 'latin1');
  const bytes = new Uint8Array(Buffer.concat([Buffer.from(good), broken]));
  const r = await PDF.extractText(bytes);
  assert.equal(r.ok, true, r.reason || '');
  assert.match(r.text, /DNS_PROBE_FINISHED_NO_INTERNET/);
  assert.ok(!/QQQQ/.test(r.text), 'the unreadable stream contributed nothing');
});

test('[12] very large text is truncated and SAYS it was truncated', async () => {
  const line = 'The application was unable to start correctly (0xc0000142). ';
  const r = await PDF.extractText(buildPdf({ compress: true, content: page(Array(6000).fill(line)) }));
  assert.equal(r.ok, true, r.reason || '');
  assert.equal(r.truncated, true);
  assert.ok(r.chars <= 200000);
  assert.match(r.note, /only the first 200000 characters/);
});

// ------------------------------- the wiring -------------------------------

test('[13] the SHIPPED widget really accepts a PDF and really extracts it locally', async () => {
  for (const p of ['../assets/aria-vision-diagnose.js', '../ARIA Sentinel/src/renderer/vendor/aria-vision-diagnose.js']) {
    const w = await fs.readFile(new URL(p, import.meta.url), 'utf8');
    assert.ok(/\.pdf/.test(w), p + ': the file picker offers PDFs');
    assert.ok(/ARIAPdfText/.test(w), p + ': the local extractor is actually called');
    assert.ok(/kind:\s*'pdf'/.test(w), p + ": the extracted text is submitted as kind:'pdf'");
    assert.ok(!/imageBase64[^\n]*pdf/i.test(w), p + ': PDF bytes are never put on an image payload');
  }
});

test('[14] the widget promises local-only handling and the extractor keeps that promise', async () => {
  const w = await fs.readFile(new URL('../assets/aria-vision-diagnose.js', import.meta.url), 'utf8');
  // The copy must not claim more than the code does.
  assert.ok(/never (?:leaves|uploaded)|stays on this device|on this device/i.test(w),
    'the PDF path tells the user the file itself does not leave');
  // And the extractor must expose no network surface at all.
  const src = await fs.readFile(new URL('../assets/aria-pdf-text.js', import.meta.url), 'utf8');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src),
    'the extractor makes no network call of any kind');
  assert.ok(!/import\s|require\s*\(/.test(src.replace(/^\s*\*.*$/gm, '')),
    'zero dependencies — nothing rented, nothing to break offline');
});

test('[15] the honest-refusal path is the one the widget shows the user (no silent empty submit)', async () => {
  const w = await fs.readFile(new URL('../assets/aria-vision-diagnose.js', import.meta.url), 'utf8');
  assert.ok(/res\.ok\s*(?:===\s*false|\?)|!\s*res\.ok|!\s*out\.ok|!\s*r\.ok/.test(w),
    'the widget branches on the extractor result instead of submitting regardless');
  assert.ok(/renderError/.test(w), 'a refusal is surfaced to the user');
});
