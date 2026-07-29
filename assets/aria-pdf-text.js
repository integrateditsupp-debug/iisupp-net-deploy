/*!
 * aria-pdf-text.js — STAGE 2 local PDF text extraction (zero dependencies, $0, offline).
 * ---------------------------------------------------------------------------------------
 * The Stage-2 spec says a user may drop an "image/log/PDF". Images and logs were built; a PDF
 * fell through to "that file type isn't supported yet". This module closes that gap WITHOUT
 * renting anything: no pdf.js, no CDN, no npm package, no paid API, no server round-trip.
 *
 * PRIVACY (the reason it runs here and not on the server):
 *   The raw PDF NEVER leaves the machine. Only the extracted text is submitted, and that text
 *   goes down the existing kind:'pdf' path — matched against the offline KB on our own server,
 *   never sent to a third-party AI model. A PDF is exactly the kind of file that carries far
 *   more than the error the user meant to show us (other pages, names, addresses, embedded
 *   metadata); extracting locally means none of that is ever uploaded.
 *
 * RULE 14 (the reason for the quality gate):
 *   A scanned PDF is a picture of text, not text. A PDF with custom font encodings and no
 *   ToUnicode map decodes to plausible-looking garbage. Either way, shipping what we got would
 *   feed the diagnoser noise dressed up as the user's error. So a recovery that does not clear
 *   an explicit quality bar returns ok:false with an honest reason, and the widget tells the
 *   user to screenshot the page instead. We never guess.
 *
 * HANDLES: uncompressed and /FlateDecode content streams; literal (…) and hex <…> strings;
 *   Tj, TJ, ' and " operators; UTF-16BE and WinAnsi; broken or absent xref tables.
 * HONESTLY REFUSES (ok:false, never a guess): encrypted PDFs, scanned/image-only PDFs,
 *   unsupported filters (LZW/JBIG2/DCT), unmappable font encodings, oversized files.
 *
 * API:  ARIAPdfText.extractText(uint8array) -> Promise<{ok,text,chars,streams,truncated,reason?,note}>
 */
(function (global) {
  'use strict';

  var MAX_BYTES = 12 * 1024 * 1024;   // refuse anything bigger rather than freeze the tab
  var MAX_CHARS = 200000;             // plenty for any error/log export; truncate past this
  var MAX_STREAMS = 500;              // scan ceiling so a hostile file cannot spin the CPU
  var MIN_CHARS = 12;                 // below this there is nothing to diagnose
  var MIN_PRINTABLE_RATIO = 0.85;     // the Rule 14 quality bar

  // ---------------------------------------------------------------------------------------
  // byte helpers
  // ---------------------------------------------------------------------------------------
  function latin1(bytes, from, to) {
    from = from || 0; to = to === undefined ? bytes.length : to;
    var out = '', CH = 8192;
    for (var i = from; i < to; i += CH) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, to)));
    }
    return out;
  }

  // PDF /FlateDecode is zlib-wrapped deflate. Some producers emit raw deflate, so try both.
  // DecompressionStream is native in browsers and in Node 18+ — no dependency on either side.
  function inflate(bytes) {
    var DS = global.DecompressionStream;
    if (typeof DS !== 'function') return Promise.reject(new Error('no-inflate'));
    return attempt('deflate').catch(function () { return attempt('deflate-raw'); });
    function attempt(fmt) {
      return new Promise(function (resolve, reject) {
        var ds, writer;
        try {
          ds = new DS(fmt);
          writer = ds.writable.getWriter();
          // These settle independently of the read side; an errored stream rejects BOTH, and an
          // unobserved rejection would surface as an unhandledRejection in the host page.
          writer.write(bytes).catch(function () {});
          writer.close().catch(function () {});
        } catch (e) { reject(e); return; }
        new Response(ds.readable).arrayBuffer()
          .then(function (buf) { resolve(new Uint8Array(buf)); }, reject);
      });
    }
  }

  // ---------------------------------------------------------------------------------------
  // object / stream discovery — deliberately NOT xref-driven, so a damaged file still works
  // ---------------------------------------------------------------------------------------
  function findStreams(doc) {
    var streams = [], re = /stream\r\n|stream\n|stream\r/g, m;
    while ((m = re.exec(doc)) !== null && streams.length < MAX_STREAMS) {
      var start = m.index + m[0].length;
      var end = doc.indexOf('endstream', start);
      if (end < 0) break;
      // The object dictionary is the text between the previous "obj" and this "stream".
      var objAt = doc.lastIndexOf(' obj', m.index);
      var dict = objAt >= 0 ? doc.slice(objAt, m.index) : '';
      var raw = doc.slice(start, end);
      // Trim the EOL the writer put before "endstream" (it is not part of the stream data).
      if (raw.charAt(raw.length - 1) === '\n') raw = raw.slice(0, -1);
      if (raw.charAt(raw.length - 1) === '\r') raw = raw.slice(0, -1);
      streams.push({ dict: dict, data: raw });
      re.lastIndex = end + 9;
    }
    return streams;
  }

  function filterOf(dict) {
    var m = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict);
    if (!m) return null;
    if (/FlateDecode/.test(m[1])) return 'flate';
    return 'unsupported';
  }

  // A content stream is what draws a page. Fonts, images, ICC profiles and metadata are not,
  // and pulling "text" out of them produces exactly the garbage the quality gate exists to stop.
  function looksLikeContentDict(dict) {
    if (/\/Subtype\s*\/Image/.test(dict)) return false;
    if (/\/Type\s*\/(Font|FontDescriptor|Metadata|XRef|ObjStm)\b/.test(dict)) return false;
    if (/\/Subtype\s*\/(Type1C|CIDFontType0C|TrueType|OpenType|XML)\b/.test(dict)) return false;
    return true;
  }
  function looksLikeContentText(s) {
    return /\bBT\b/.test(s) && (/\bTj\b/.test(s) || /\bTJ\b/.test(s) || /\bT[dDm]\b/.test(s));
  }

  // ---------------------------------------------------------------------------------------
  // string decoding
  // ---------------------------------------------------------------------------------------
  // WinAnsi (CP1252) specials in 0x80-0x9F; the undefined slots are dropped rather than turned
  // into control characters (which would silently drag the quality ratio down).
  var WINANSI = {
    0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
    0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š',
    0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž', 0x91: '‘', 0x92: '’',
    0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
    0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ',
    0x9E: 'ž', 0x9F: 'Ÿ'
  };

  function decodeBytes(codes) {
    // UTF-16BE is flagged by a byte-order mark, per the PDF spec.
    if (codes.length >= 2 && codes[0] === 0xFE && codes[1] === 0xFF) {
      var u = '';
      for (var i = 2; i + 1 < codes.length; i += 2) u += String.fromCharCode((codes[i] << 8) | codes[i + 1]);
      return u;
    }
    var out = '';
    for (var j = 0; j < codes.length; j++) {
      var c = codes[j];
      if (c >= 0x80 && c <= 0x9F) { if (WINANSI[c]) out += WINANSI[c]; continue; }
      out += String.fromCharCode(c);
    }
    return out;
  }

  // Reads a literal string starting AFTER the '(' and returns {text, next}.
  function readLiteral(s, i) {
    var codes = [], depth = 0;
    for (; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      if (ch === 0x5C) {                       // backslash escape
        var n = s.charAt(i + 1);
        if (n === 'n') { codes.push(10); i++; continue; }
        if (n === 'r') { codes.push(13); i++; continue; }
        if (n === 't') { codes.push(9); i++; continue; }
        if (n === 'b') { codes.push(8); i++; continue; }
        if (n === 'f') { codes.push(12); i++; continue; }
        if (n === '\n') { i++; continue; }     // line continuation
        if (n === '\r') { i++; if (s.charAt(i + 1) === '\n') i++; continue; }
        if (n >= '0' && n <= '7') {            // octal, 1-3 digits
          var oct = '';
          while (oct.length < 3) {
            var d = s.charAt(i + 1);
            if (d < '0' || d > '7') break;
            oct += d; i++;
          }
          codes.push(parseInt(oct, 8) & 0xFF); continue;
        }
        codes.push(s.charCodeAt(i + 1)); i++; continue;
      }
      if (ch === 0x28) { depth++; codes.push(ch); continue; }        // nested (
      if (ch === 0x29) {                                            // )
        if (depth === 0) return { text: decodeBytes(codes), next: i + 1 };
        depth--; codes.push(ch); continue;
      }
      codes.push(ch);
    }
    return { text: decodeBytes(codes), next: s.length };
  }

  // Reads a hex string starting AT the '<' and returns {text, next}.
  function readHex(s, i) {
    var end = s.indexOf('>', i);
    if (end < 0) end = s.length;
    var hex = s.slice(i + 1, end).replace(/[^0-9A-Fa-f]/g, '');
    if (hex.length % 2) hex += '0';
    var codes = [];
    for (var k = 0; k < hex.length; k += 2) codes.push(parseInt(hex.substr(k, 2), 16));
    return { text: decodeBytes(codes), next: end + 1 };
  }

  // ---------------------------------------------------------------------------------------
  // content-stream text extraction
  // ---------------------------------------------------------------------------------------
  function textFromContent(s) {
    var out = [], line = [], pending = [], i = 0, inArray = false;

    function flushLine() { if (line.length) { out.push(line.join('')); line = []; } }

    while (i < s.length) {
      var c = s.charAt(i);

      if (c === '(') { var lit = readLiteral(s, i + 1); pending.push(lit.text); i = lit.next; continue; }
      if (c === '<' && s.charAt(i + 1) !== '<') { var hx = readHex(s, i); pending.push(hx.text); i = hx.next; continue; }
      if (c === '%') { var nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl + 1; continue; }  // comment
      if (c === '[') { inArray = true; i++; continue; }
      if (c === ']') { inArray = false; i++; continue; }

      // Inside a TJ array the numbers are kerning in thousandths of an em. A justified line
      // writes its word gaps as kerning rather than as space characters, so a large negative
      // adjustment IS a space and dropping it would glue words together ("diskisfull").
      // -100/1000 em is the long-standing threshold; smaller values are intra-word tracking.
      if (inArray && (c === '-' || c === '.' || (c >= '0' && c <= '9'))) {
        var nm = /^-?\d*\.?\d+/.exec(s.slice(i));
        if (nm) {
          if (parseFloat(nm[0]) <= -100) pending.push(' ');
          i += nm[0].length;
          continue;
        }
      }

      if (/[A-Za-z'"*]/.test(c)) {                       // operator token
        var m = /^[A-Za-z*'"]+/.exec(s.slice(i));
        var op = m ? m[0] : c;
        i += op.length;
        if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
          if (op === "'" || op === '"') flushLine();     // both move to the next line first
          line.push(pending.join(''));
          pending = [];
        } else if (op === 'Td' || op === 'TD' || op === 'T*' || op === 'Tm' || op === 'ET' || op === 'BT') {
          flushLine();
          pending = [];
        } else {
          pending = [];                                   // operands belonged to some other op
        }
        continue;
      }
      i++;
    }
    flushLine();
    return out.join('\n');
  }

  function tidy(text) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function printableRatio(text) {
    if (!text.length) return 0;
    var good = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c === 9 || c === 10 || c === 13) { good++; continue; }
      if (c >= 32 && c <= 126) { good++; continue; }
      if (c >= 160 && c <= 0x2122) { good++; continue; }   // latin-1 supplement + common punctuation
    }
    return good / text.length;
  }

  // ---------------------------------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------------------------------
  function fail(reason, note) {
    return { ok: false, text: '', chars: 0, streams: 0, truncated: false, reason: reason, note: note };
  }

  function extractText(bytes) {
    try {
      if (!bytes || typeof bytes.length !== 'number') {
        return Promise.resolve(fail('no-data', 'No file data was read.'));
      }
      if (bytes.length > MAX_BYTES) {
        return Promise.resolve(fail('pdf-too-large',
          'That PDF is larger than ' + Math.round(MAX_BYTES / 1048576) + ' MB. Export just the page with the error, or screenshot it.'));
      }
      var head = latin1(bytes, 0, Math.min(1024, bytes.length));
      if (head.indexOf('%PDF-') < 0) {
        return Promise.resolve(fail('not-a-pdf', 'That file is not a PDF.'));
      }

      var doc = latin1(bytes);
      if (/\/Encrypt\b/.test(doc)) {
        return Promise.resolve(fail('encrypted-pdf',
          'That PDF is password-protected, so its text cannot be read here. Open it and screenshot the error instead.'));
      }

      var streams = findStreams(doc);
      if (!streams.length) {
        return Promise.resolve(fail('no-readable-streams',
          'No readable text streams were found in that PDF. Screenshot the page with the error and drop that instead.'));
      }

      var sawUnsupportedFilter = false;
      var jobs = streams.map(function (st) {
        if (!looksLikeContentDict(st.dict)) return Promise.resolve('');
        var f = filterOf(st.dict);
        if (f === 'unsupported') { sawUnsupportedFilter = true; return Promise.resolve(''); }
        if (f === null) {
          return Promise.resolve(looksLikeContentText(st.data) ? textFromContent(st.data) : '');
        }
        var raw = new Uint8Array(st.data.length);
        for (var i = 0; i < st.data.length; i++) raw[i] = st.data.charCodeAt(i) & 0xFF;
        return inflate(raw).then(function (out) {
          var s = latin1(out);
          return looksLikeContentText(s) ? textFromContent(s) : '';
        }, function () { return ''; });          // a stream we cannot inflate is skipped, never guessed
      });

      return Promise.all(jobs).then(function (parts) {
        var used = parts.filter(function (p) { return p && p.trim().length; });
        var text = tidy(used.join('\n\n'));
        var truncated = false;
        if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); truncated = true; }

        if (text.length < MIN_CHARS) {
          return fail(sawUnsupportedFilter ? 'unsupported-pdf-encoding' : 'no-text-layer',
            sawUnsupportedFilter
              ? 'That PDF uses a compression this reader does not support, so no text could be recovered. Screenshot the page with the error and drop that instead.'
              : 'That PDF has no selectable text - it is a scan or an image. Screenshot the page with the error and drop that instead.');
        }
        var ratio = printableRatio(text);
        if (ratio < MIN_PRINTABLE_RATIO) {
          // Rule 14: bytes came back, but they are not trustworthy text. Say so; do not ship it.
          return fail('text-not-recoverable',
            'The text in that PDF uses an embedded font encoding this reader cannot map, so what came back is not reliable. Screenshot the page with the error and drop that instead.');
        }

        return {
          ok: true,
          text: text,
          chars: text.length,
          streams: used.length,
          truncated: truncated,
          quality: Math.round(ratio * 100) / 100,
          note: 'Text was extracted from the PDF on this device. The PDF file itself was never uploaded'
              + (truncated ? '; only the first ' + MAX_CHARS + ' characters are used.' : '.')
        };
      }, function (e) {
        return fail('pdf-read-failed', 'That PDF could not be read (' + (e && e.message ? e.message : 'unknown error') + '). Screenshot the error instead.');
      });
    } catch (e) {
      return Promise.resolve(fail('pdf-read-failed', 'That PDF could not be read. Screenshot the error instead.'));
    }
  }

  var API = { extractText: extractText, version: '1.0.0' };
  if (typeof module === 'object' && module.exports) module.exports = API;
  global.ARIAPdfText = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
