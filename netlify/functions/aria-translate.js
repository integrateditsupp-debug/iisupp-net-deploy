/**
 * aria-translate — On-demand translation via Anthropic Claude
 *  Free for the platform — same Claude API key already used for ARIA chat.
 *
 *  POST { event:'translate', text, target_lang, source_lang?, context? }
 *    -> { ok, translated, source_lang, cached }
 *  POST { event:'bulk', items:[{key, text}], target_lang, context? }
 *    -> { ok, translations: {key:translated, ...} }
 *  POST { event:'detect', text }
 *    -> { ok, detected_lang, confidence }
 *
 *  Cache: per (source-text-hash + target_lang) in Netlify Blobs.
 *         First call hits Claude, repeat calls are free + instant.
 *  Cat 8 — Localization (free, on-demand, scales infinitely).
 */
const crypto = require('crypto');

const SUPPORTED_LANGS = ['en','fr','es','de','ar','zh','ur','hi','pt','ja','ko','ru','it','nl','tr','vi','th','id','pl','sv'];

let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-translations', consistency: 'eventual' });
  } catch { _blobs = false; }
  return _blobs;
}

function hashKey(text, target) {
  return crypto.createHash('sha256').update(text + '|' + target).digest('hex').slice(0, 32);
}

async function callClaude(prompt, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('claude ' + r.status + ': ' + (j.error?.message || JSON.stringify(j)));
  return (j.content?.[0]?.text || '').trim();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'translate').trim();
  const store = await getStore();

  if (ev === 'translate') {
    const text = String(body.text || '').slice(0, 8000);
    const target = String(body.target_lang || '').toLowerCase().trim();
    if (!text || !target) return ok({ ok: false, error: 'text + target_lang required' });
    if (!SUPPORTED_LANGS.includes(target)) return ok({ ok: false, error: 'unsupported target_lang', supported: SUPPORTED_LANGS });

    // Cache lookup
    const ck = hashKey(text, target);
    if (store) {
      try {
        const cached = await store.get('t-' + ck, { type: 'json' });
        if (cached) return ok({ ok: true, translated: cached.translated, source_lang: cached.source_lang, cached: true });
      } catch {}
    }

    const context = body.context ? ' Context: ' + String(body.context).slice(0, 200) + '.' : '';
    const prompt = 'Translate the following text to ' + target + ' language code (ISO 639-1).' + context + ' Output ONLY the translation, no explanation, no quotes, no preamble. If the text is already in ' + target + ', return it unchanged.\n\nText:\n' + text;

    try {
      const translated = await callClaude(prompt, Math.min(2048, text.length * 3 + 200));
      if (store) {
        try { await store.setJSON('t-' + ck, { translated, source_lang: 'auto', ts: Date.now() }); } catch {}
      }
      return ok({ ok: true, translated, source_lang: 'auto', cached: false });
    } catch (e) {
      return ok({ ok: false, error: 'translation_failed', detail: e.message });
    }
  }

  if (ev === 'bulk') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    const target = String(body.target_lang || '').toLowerCase().trim();
    if (!items.length || !target) return ok({ ok: false, error: 'items + target_lang required' });
    if (!SUPPORTED_LANGS.includes(target)) return ok({ ok: false, error: 'unsupported target_lang' });

    // Check cache for each first
    const results = {};
    const toTranslate = [];
    for (const item of items) {
      const text = String(item.text || '').slice(0, 2000);
      const ck = hashKey(text, target);
      if (store) {
        try {
          const cached = await store.get('t-' + ck, { type: 'json' });
          if (cached) { results[item.key] = cached.translated; continue; }
        } catch {}
      }
      toTranslate.push({ key: item.key, text, ck });
    }

    if (toTranslate.length === 0) return ok({ ok: true, translations: results, cached_all: true });

    // Send untranslated as single Claude call with structured output
    const numbered = toTranslate.map((it, i) => `[${i + 1}] ${it.text}`).join('\n');
    const context = body.context ? ' Context: ' + String(body.context).slice(0, 200) + '.' : '';
    const prompt = 'Translate each numbered line below to ' + target + ' (ISO 639-1 code).' + context +
      ' Output ONLY translations, one per line, prefixed by the same [N] marker. No commentary. Preserve any {placeholders} unchanged.\n\n' + numbered;

    try {
      const out = await callClaude(prompt, 3500);
      // Parse out
      const lines = out.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const m = line.match(/^\[(\d+)\]\s*(.+)$/);
        if (m) {
          const idx = parseInt(m[1], 10) - 1;
          if (idx >= 0 && idx < toTranslate.length) {
            const tr = m[2].trim();
            results[toTranslate[idx].key] = tr;
            if (store) {
              try { await store.setJSON('t-' + toTranslate[idx].ck, { translated: tr, source_lang: 'auto', ts: Date.now() }); } catch {}
            }
          }
        }
      }
      return ok({ ok: true, translations: results });
    } catch (e) {
      return ok({ ok: false, error: 'bulk_translation_failed', detail: e.message, partial: results });
    }
  }

  if (ev === 'detect') {
    const text = String(body.text || '').slice(0, 2000);
    if (!text) return ok({ ok: false, error: 'text required' });
    try {
      const out = await callClaude('Identify the language of the following text and respond with ONLY the ISO 639-1 two-letter code (e.g. en, fr, es, de, ar, zh, hi, ja, ko, ru, pt, it, ur). No explanation.\n\nText:\n' + text, 16);
      const code = out.toLowerCase().match(/[a-z]{2}/)?.[0] || 'en';
      return ok({ ok: true, detected_lang: code, confidence: SUPPORTED_LANGS.includes(code) ? 'high' : 'low' });
    } catch (e) {
      return ok({ ok: false, error: 'detect_failed', detail: e.message });
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

module.exports.SUPPORTED_LANGS = SUPPORTED_LANGS;
