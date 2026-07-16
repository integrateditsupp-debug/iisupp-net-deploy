import Busboy from 'busboy';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import {
  CONTENT_ASSURANCE_STORE,
  SESSION_TTL_MS,
  MAX_FILE_MB,
  MAX_PAGES,
  MAX_WORDS,
  getScopedStore,
  boolish,
  buildReport,
  countWords,
  estimatePages,
  jsonResponse,
  normalizeGoal,
  normalizeModules,
  normalizeText,
  optionsResponse,
  sha256
} from './lib/content-assurance.mjs';

const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export default async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'POST only' });

  const contentType = String(event.headers['content-type'] || event.headers['Content-Type'] || '');
  if (!/multipart\/form-data/i.test(contentType)) {
    return jsonResponse(400, { error: 'Expected multipart/form-data upload.' });
  }

  let payload;
  try {
    payload = await parseMultipart(event);
  } catch (error) {
    return jsonResponse(400, { error: 'Could not read upload payload.', detail: error.message });
  }

  const fields = payload.fields || {};
  const file = payload.file || null;
  const transcript = normalizeText(fields.transcript || '');
  const rightsConfirmed = boolish(fields.rightsAttestation);
  const modules = normalizeModules(fields.modules || '[]');
  const goal = normalizeGoal(fields.goal);
  const location = normalizeText(fields.location || '').slice(0, 120);

  if (!rightsConfirmed) {
    return jsonResponse(400, { error: 'Rights attestation is required before analysis.' });
  }
  if (modules.length < 3) {
    return jsonResponse(400, { error: 'Select at least three modules before analysis.' });
  }
  if (!file && !transcript) {
    return jsonResponse(400, { error: 'Upload a supported file or paste a transcript.' });
  }

  try {
    const source = await extractSource({ file, transcript });
    if (source.fileSizeBytes > MAX_FILE_BYTES) {
      return jsonResponse(400, { error: `File exceeds the ${MAX_FILE_MB} MB limit.` });
    }
    if (source.wordCount > MAX_WORDS) {
      return jsonResponse(400, { error: `File exceeds the ${MAX_WORDS.toLocaleString()} word limit for the MVP.` });
    }
    if (source.pageCount > MAX_PAGES) {
      return jsonResponse(400, { error: `File exceeds the ${MAX_PAGES} page limit for the MVP.` });
    }

    const report = await buildReport({
      text: source.text,
      modules,
      goal,
      sourceMeta: {
        fileName: source.fileName,
        fileType: source.fileType,
        fileSizeBytes: source.fileSizeBytes,
        pageCount: source.pageCount,
        wordCount: source.wordCount,
        sourceHash: sha256(source.text).slice(0, 24),
        location
      }
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    const session = {
      sessionId: report.sessionId,
      createdAt: now.toISOString(),
      expiresAt,
      report,
      modules,
      goal,
      unlocked: false,
      paid: false,
      deliveryToken: null,
      checkoutEmail: '',
      deliveryAudit: [],
      sourceMeta: report.sourceMeta
    };

    const store = getScopedStore(CONTENT_ASSURANCE_STORE);
    await store.setJSON('session-' + report.sessionId, session);

    return jsonResponse(200, {
      ok: true,
      sessionId: report.sessionId,
      expiresAt,
      report,
      limits: {
        fileMb: MAX_FILE_MB,
        maxPages: MAX_PAGES,
        maxWords: MAX_WORDS
      }
    });
  } catch (error) {
    return jsonResponse(500, { error: 'Analysis failed.', detail: error.message });
  }
};

async function parseMultipart(event) {
  const headers = {};
  for (const [key, value] of Object.entries(event.headers || {})) headers[key.toLowerCase()] = value;
  const bodyBuffer = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');

  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null;
    const bb = Busboy({ headers });

    bb.on('file', (fieldName, stream, info = {}) => {
      const chunks = [];
      let total = 0;
      stream.on('data', (chunk) => {
        total += chunk.length;
        if (total <= MAX_FILE_BYTES + 1024) chunks.push(chunk);
      });
      stream.on('end', () => {
        if (!file) {
          file = {
            fieldName,
            fileName: info.filename || 'upload',
            mimeType: info.mimeType || 'application/octet-stream',
            buffer: Buffer.concat(chunks),
            fileSizeBytes: total
          };
        }
      });
    });

    bb.on('field', (name, value) => {
      fields[name] = value;
    });
    bb.on('error', reject);
    bb.on('finish', () => resolve({ fields, file }));
    bb.end(bodyBuffer);
  });
}

async function extractSource({ file, transcript }) {
  if (transcript) {
    const text = normalizeText(transcript);
    return {
      fileName: 'pasted-transcript.txt',
      fileType: 'text/plain',
      fileSizeBytes: Buffer.byteLength(text, 'utf8'),
      pageCount: estimatePages(text),
      wordCount: countWords(text),
      text
    };
  }

  const name = String(file.fileName || 'upload');
  const extension = name.toLowerCase().split('.').pop();
  if (!file.buffer?.length) throw new Error('Uploaded file was empty.');

  if (file.fileSizeBytes > MAX_FILE_BYTES) {
    return {
      fileName: name,
      fileType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      pageCount: MAX_PAGES + 1,
      wordCount: MAX_WORDS + 1,
      text: ''
    };
  }

  if (extension === 'txt' || extension === 'md' || /^text\//i.test(file.mimeType)) {
    const text = normalizeText(file.buffer.toString('utf8'));
    return {
      fileName: name,
      fileType: 'text/plain',
      fileSizeBytes: file.fileSizeBytes,
      pageCount: estimatePages(text),
      wordCount: countWords(text),
      text
    };
  }

  if (extension === 'pdf' || /pdf/i.test(file.mimeType)) {
    const parser = new PDFParse({ data: file.buffer });
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo({ parsePageInfo: true })
    ]);
    await parser.destroy();
    const parsedText = textResult?.text || '';
    const text = normalizeText(parsedText);
    return {
      fileName: name,
      fileType: 'application/pdf',
      fileSizeBytes: file.fileSizeBytes,
      pageCount: infoResult?.total || estimatePages(parsedText),
      wordCount: countWords(text),
      text
    };
  }

  if (extension === 'docx' || /wordprocessingml/i.test(file.mimeType)) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    const text = normalizeText(parsed.value || '');
    return {
      fileName: name,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSizeBytes: file.fileSizeBytes,
      pageCount: estimatePages(text),
      wordCount: countWords(text),
      text
    };
  }

  throw new Error('Unsupported file type. Use text, PDF, DOCX, or paste a transcript.');
}
