// ARIA Company Knowledge Base — local store of uploaded company policies,
// procedures, FAQs, and internal instructions. Backed by IndexedDB so it
// survives reloads and survives weeks of use.
//
// Architecture
// ------------
//   Document = an uploaded file or pasted text.       (object store: documents)
//     - Soft-deleted (active=0) when the user removes it, never hard-deleted,
//       so historical context stays available for ARIA's reference.
//     - Versioned: re-uploading the same name supersedes; the prior version
//       remains in the store with active=0 and an updated label.
//   Chunk    = ~500-char slice of a document, pre-tokenised for fast retrieval.
//     (object store: chunks)
//
// Retrieval (used by aria-trial.js):
//   searchCompanyDocs(query) → top chunks with score, doc name, position.
//   Caller compares the top score vs. the built-in KB top score and picks
//   whichever is more confident. Company docs WIN on tie (per user's spec:
//   "ARIA should prioritize company policy over general AI advice").
//
// Privacy
// -------
//   All data is browser-local (IndexedDB on the iisupport.net origin).
//   Never transmitted to any server. Per-device.
//
// Supported file types (Stage 1)
//   .txt  .md  .markdown  .csv  .json  .log   — read inline
//   .html .htm                                  — strip tags inline
//   .pdf                                        — pdf.js (lazy-loaded from CDN)
//   anything else → user gets a clear "convert to PDF or paste as text" hint.

const DB_NAME = 'aria-company-kb';
const DB_VERSION = 1;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const COMPANY_SCORE_FLOOR = 8; // below this we don't claim a match

const STOP = new Set(['a','an','and','as','at','be','by','for','from','i','in','is','it','my','of','on','or','our','so','that','the','this','to','was','were','will','with','you','your','me','have','has','had','do','does','did','am','if','then','than','but','some','any','all','just','can','cant','wont','should','would','could']);

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text) return [];
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      // Prefer to end on a sentence/paragraph boundary so chunks read naturally.
      const dot = text.lastIndexOf('. ', end);
      const para = text.lastIndexOf('\n\n', end);
      const boundary = Math.max(dot, para);
      if (boundary > i + size * 0.5) end = boundary + 2;
    }
    const slice = text.slice(i, end).trim();
    if (slice) out.push({ text: slice, position: i });
    if (end >= text.length) break;
    i = end - overlap;
    if (i <= 0) i = end;
  }
  return out;
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('documents')) {
        const docs = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
        docs.createIndex('name', 'name', { unique: false });
        docs.createIndex('active', 'active', { unique: false });
      }
      if (!db.objectStoreNames.contains('chunks')) {
        const ch = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
        ch.createIndex('docId', 'docId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txAll(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    try { result = fn(tx); } catch (e) { reject(e); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

// ─── File reading ────────────────────────────────────────────────────────────
async function readFileAsText(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['txt','md','markdown','csv','json','log','yml','yaml','rst'].includes(ext)) {
    return await file.text();
  }
  if (['html','htm'].includes(ext)) {
    const html = await file.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }
  if (ext === 'pdf') return await readPDF(file);
  throw new Error(`Unsupported file type: .${ext}. Save as PDF or paste the text directly.`);
}

let _pdfjsPromise = null;
async function loadPDFJS() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const mod = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
      mod.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
      return mod;
    })().catch(err => { _pdfjsPromise = null; throw err; });
  }
  return _pdfjsPromise;
}

async function readPDF(file) {
  const pdfjs = await loadPDFJS();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map(it => it.str).join(' '));
  }
  return pages.join('\n\n');
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function isAvailable() {
  try { await openDB(); return true; } catch { return false; }
}

export async function addDocumentText({ name, text, type = 'text/plain', size = null, source = 'paste' }) {
  if (!text || !name) throw new Error('Both `name` and `text` are required.');
  const trimmedText = text.trim();
  if (trimmedText.length < 10) throw new Error('Document is empty or too short.');
  // Soft-supersede any earlier active doc with the same name.
  await supersedeByName(name);

  return await txAll(['documents','chunks'], 'readwrite', (tx) => {
    return new Promise((resolve, reject) => {
      const docs = tx.objectStore('documents');
      const chunks = tx.objectStore('chunks');
      const r = docs.add({
        name,
        type,
        size: size ?? trimmedText.length,
        uploadedAt: new Date().toISOString(),
        length: trimmedText.length,
        active: 1,
        source,
      });
      r.onsuccess = () => {
        const docId = r.result;
        const slices = chunkText(trimmedText);
        for (const s of slices) {
          chunks.add({ docId, text: s.text, position: s.position, tokens: tokenize(s.text) });
        }
        resolve({ id: docId, chunkCount: slices.length });
      };
      r.onerror = () => reject(r.error);
    });
  });
}

export async function addFile(file) {
  if (!file) throw new Error('No file provided.');
  if (file.size > MAX_FILE_BYTES) throw new Error('File exceeds 10 MB limit.');
  const text = await readFileAsText(file);
  return await addDocumentText({
    name: file.name,
    text,
    type: file.type || 'text/plain',
    size: file.size,
    source: 'upload',
  });
}

export async function listDocuments({ includeInactive = false } = {}) {
  const all = await txAll('documents', 'readonly', (tx) => {
    return new Promise((resolve, reject) => {
      const r = tx.objectStore('documents').getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  });
  return includeInactive ? all : all.filter(d => d.active);
}

export async function removeDocument(id) {
  // Soft-delete: keep the document for historical retrieval if the user later
  // un-removes, but exclude it from active search.
  return await txAll('documents', 'readwrite', (tx) => {
    return new Promise((resolve, reject) => {
      const docs = tx.objectStore('documents');
      const r = docs.get(id);
      r.onsuccess = () => {
        const d = r.result;
        if (!d) return resolve(false);
        d.active = 0;
        d.deactivatedAt = new Date().toISOString();
        const upd = docs.put(d);
        upd.onsuccess = () => resolve(true);
        upd.onerror = () => reject(upd.error);
      };
      r.onerror = () => reject(r.error);
    });
  });
}

async function supersedeByName(name) {
  return await txAll('documents', 'readwrite', (tx) => {
    return new Promise((resolve, reject) => {
      const docs = tx.objectStore('documents');
      const idx = docs.index('name');
      const range = IDBKeyRange.only(name);
      const cursorReq = idx.openCursor(range);
      cursorReq.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) return resolve();
        const v = cur.value;
        if (v.active) {
          v.active = 0;
          v.supersededAt = new Date().toISOString();
          cur.update(v);
        }
        cur.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  });
}

export async function clearAll() {
  return await txAll(['documents','chunks'], 'readwrite', (tx) => {
    tx.objectStore('documents').clear();
    tx.objectStore('chunks').clear();
  });
}

// Token-overlap retrieval over active chunks.
// Returns sorted top-K with { docId, docName, text, score, position }.
export async function searchCompanyDocs(query, opts = {}) {
  const topK = opts.topK || 3;
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const { docs, chunks } = await txAll(['documents','chunks'], 'readonly', (tx) => {
    return Promise.all([
      new Promise((resolve, reject) => {
        const r = tx.objectStore('documents').getAll();
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      }),
      new Promise((resolve, reject) => {
        const r = tx.objectStore('chunks').getAll();
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      }),
    ]).then(([docs, chunks]) => ({ docs, chunks }));
  });

  const activeIds = new Set(docs.filter(d => d.active).map(d => d.id));
  const docMap = new Map(docs.map(d => [d.id, d]));
  const lowerQ = query.toLowerCase();
  const queryTokenSet = new Set(queryTokens);

  const scored = [];
  for (const ch of chunks) {
    if (!activeIds.has(ch.docId)) continue;
    const doc = docMap.get(ch.docId);
    let score = 0;
    const tokenSet = new Set(ch.tokens || []);
    for (const t of queryTokenSet) if (tokenSet.has(t)) score += 3;
    // Doc-name boost — when the user mentions words from the document title
    // ("at Acme Corp", "BYOD policy"), this is almost certainly the right doc.
    const docNameTokens = new Set(tokenize(doc?.name || ''));
    for (const t of queryTokenSet) if (docNameTokens.has(t)) score += 5;
    // Phrase boost: full or partial substring match in the chunk.
    if (lowerQ.length > 12 && ch.text.toLowerCase().includes(lowerQ)) score += 16;
    else if (lowerQ.length > 6 && ch.text.toLowerCase().includes(lowerQ.slice(0, 60))) score += 8;
    if (score > 0) {
      scored.push({
        docId: ch.docId,
        docName: doc?.name || 'Document',
        text: ch.text,
        position: ch.position,
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export const COMPANY_KB_SCORE_FLOOR = COMPANY_SCORE_FLOOR;

export async function getStats() {
  const { docs, chunkCount } = await txAll(['documents','chunks'], 'readonly', (tx) => {
    return Promise.all([
      new Promise((resolve, reject) => {
        const r = tx.objectStore('documents').getAll();
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      }),
      new Promise((resolve, reject) => {
        const r = tx.objectStore('chunks').count();
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      }),
    ]).then(([docs, chunkCount]) => ({ docs, chunkCount }));
  });
  let estimate = null;
  try { estimate = await navigator.storage?.estimate?.(); } catch {}
  return {
    activeDocuments: docs.filter(d => d.active).length,
    totalDocuments: docs.length,
    totalChunks: chunkCount,
    quotaBytes: estimate?.quota,
    usageBytes: estimate?.usage,
  };
}

export function formatBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n/(1024*1024)).toFixed(1)} MB`;
  return `${(n/(1024*1024*1024)).toFixed(2)} GB`;
}
