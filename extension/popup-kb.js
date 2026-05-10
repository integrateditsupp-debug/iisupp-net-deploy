// Local KB lookup for the ARIA popup.
// Loads the bundled kb-index.json once, then runs the same retrieval pipeline
// the website widget uses. Exposed as window.AriaPopupKB.lookup(query).
//
// Module-loaded (popup.html: <script type="module" src="popup-kb.js"></script>)
// so popup.js (classic script) can call it after DOMContentLoaded.

import { retrieve, classify } from './aria-kb-retrieval.mjs';

let kbPromise = null;

function loadKB() {
  if (!kbPromise) {
    kbPromise = fetch(chrome.runtime.getURL('kb-index.json'))
      .then(r => {
        if (!r.ok) throw new Error(`kb fetch ${r.status}`);
        return r.json();
      })
      .catch(err => {
        console.warn('[aria-popup-kb] index load failed:', err);
        kbPromise = null;
        return null;
      });
  }
  return kbPromise;
}

async function lookup(query) {
  const idx = await loadKB();
  if (!idx) return null;
  const results = retrieve(query, idx.articles, { topK: 3 });
  if (!results.length) return null;
  // Confidence floor: a strong routing match is ~25, a single keyword phrase ~12.
  // Below 8 we let the network fallback handle it (user might want a web answer).
  const top = results[0];
  if (top.score < 8) return null;
  return {
    id: top.id,
    title: top.title,
    level: top.level,
    severity: top.severity,
    body: top.user_friendly || top.symptoms?.split('\n')[0] || top.title,
    escalation: top.escalation_trigger || '',
    related: results.slice(1).map(r => ({ id: r.id, title: r.title, level: r.level })),
    classify: classify(query),
  };
}

window.AriaPopupKB = { lookup, loadKB };
