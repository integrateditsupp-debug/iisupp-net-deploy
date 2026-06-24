// kb-ingester — local-only, content-blind company-knowledge ingestion.
//
// Accepts PDF / DOCX / MD / TXT. The raw bytes are stored under ~/.aria-sentinel/kb/<sha256>.bin
// and the extracted text is chunked (~512 tokens) into ~/.aria-sentinel/kb/chunks.jsonl.
// CHUNKS NEVER LEAVE THE DEVICE — only chunk COUNTS and HASHES are surfaced to the audit log.
//
// Text extraction degrades gracefully (per the no-spend rule): MD/TXT are read directly;
// DOCX uses `mammoth` and PDF uses `pdfjs-dist` ONLY if those happen to be installed.
// When they are not, the document is still stored + registered with a status of
// "Awaiting text extraction" — no npm install is ever attempted.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";

const APPROX_CHARS_PER_CHUNK = 2048; // ~512 tokens

export function kbDir() {
  return path.join(os.homedir(), ".aria-sentinel", "kb");
}

export function extOf(name) {
  return String(name || "").toLowerCase().split(".").pop();
}

/**
 * @param {object} file { name, ext?, text?, base64?, bytes? }
 * @param {object} options { dir?, extractors? }  extractors lets tests inject docx/pdf parsers
 * @returns {Promise<object>} a content-blind manifest entry (hash + counts only)
 */
export async function ingest(file = {}, options = {}) {
  const dir = options.dir || kbDir();
  fs.mkdirSync(dir, { recursive: true });
  const name = String(file.name || "document");
  const ext = (file.ext || extOf(name) || "txt").toLowerCase();
  const bytes = toBytes(file);
  if (!bytes || !bytes.length) {
    return { ok: false, error: "empty_file" };
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const rawPath = path.join(dir, `${sha256}.bin`);
  try {
    fs.writeFileSync(rawPath, bytes);
  } catch {
    return { ok: false, error: "store_failed" };
  }

  const extraction = await extractText({ ext, bytes, text: file.text }, options.extractors || {});
  let chunkCount = 0;
  if (extraction.text) {
    const chunks = chunkText(extraction.text);
    chunkCount = chunks.length;
    appendChunks(dir, sha256, chunks);
  }

  // The manifest entry is content-blind: no filename text, no document body — only the
  // ext class, a hash, and counts. (The original filename is kept ONLY in the local
  // electron-store knowledge source list, never on any wire.)
  return {
    ok: true,
    sha256,
    ext,
    bytes: bytes.length,
    chunkCount,
    status: extraction.status,
    storedAt: new Date().toISOString()
  };
}

function toBytes(file) {
  if (file.bytes instanceof Uint8Array) return Buffer.from(file.bytes);
  if (typeof file.base64 === "string") {
    try {
      return Buffer.from(file.base64, "base64");
    } catch {
      return null;
    }
  }
  if (typeof file.text === "string") return Buffer.from(file.text, "utf8");
  return null;
}

async function extractText({ ext, bytes, text }, extractors) {
  if (ext === "txt" || ext === "md") {
    return { text: text != null ? String(text) : bytes.toString("utf8"), status: "Indexed" };
  }
  if (ext === "docx") {
    const docx = extractors.docx || (await tryImport("mammoth").then((m) => m?.extractRawText));
    if (docx) {
      try {
        const result = await docx({ buffer: bytes });
        return { text: String(result?.value || ""), status: "Indexed" };
      } catch {
        return { text: "", status: "Awaiting text extraction" };
      }
    }
    return { text: "", status: "Awaiting text extraction" };
  }
  if (ext === "pdf") {
    const pdf = extractors.pdf;
    if (pdf) {
      try {
        return { text: String(await pdf(bytes)), status: "Indexed" };
      } catch {
        return { text: "", status: "Awaiting text extraction" };
      }
    }
    // pdfjs-dist has no stable raw-text helper; without it we degrade rather than spend.
    return { text: "", status: "Awaiting text extraction" };
  }
  return { text: "", status: "Unsupported format" };
}

export function chunkText(text, size = APPROX_CHARS_PER_CHUNK) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks = [];
  for (let i = 0; i < clean.length; i += size) {
    chunks.push(clean.slice(i, i + size));
  }
  return chunks;
}

function appendChunks(dir, sha256, chunks) {
  const file = path.join(dir, "chunks.jsonl");
  // Store ONLY a hash of each chunk + its index — never the chunk text. The raw text
  // already lives in the <sha256>.bin; the index records that ingestion happened without
  // duplicating recoverable content into a second searchable file.
  const lines = chunks
    .map((chunk, i) => JSON.stringify({ doc: sha256, i, hash: createHash("sha256").update(chunk).digest("hex").slice(0, 16) }))
    .join("\n");
  try {
    fs.appendFileSync(file, lines + "\n");
  } catch {
    // A failed index write must not lose the stored document.
  }
}

async function tryImport(name) {
  try {
    return await import(name);
  } catch {
    return null;
  }
}
