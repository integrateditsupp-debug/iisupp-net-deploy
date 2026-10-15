// Build-time helper — download the small offline en-US Vosk model that ships with the app (extraResources) so
// tap-to-speak runs 100% ON-DEVICE. This is a DEVELOPER/BUILD step (run by `npm run prepackage`), NOT app code:
// it is never bundled and never runs on a user's machine. The model itself is ~40 MB and adds ~40-50 MB to the
// installer (honest size note); it is intentionally NOT committed to git (see .gitignore) to keep the repo lean.
//
// At runtime the app makes NO network call for speech — it loads this locally-bundled model as a file:// URL and
// transcribes in-process (see src/renderer/local-stt.mjs). Only this build script touches the network, and only
// to fetch the model from Vosk's official distribution.
//
// REVIEW P2-11 (2026-10-14) — THE DOWNLOAD IS PINNED. Whatever this script downloads ships inside the installer, so it
// is checked against a SHA-256 the owner pinned BEFORE anything is extracted:
//   VOSK_MODEL_SHA256=<64 hex>   (environment; wins)   or   scripts/vosk-model.sha256   (the hash, sha256sum format ok)
// No pin → REFUSED, nothing is downloaded (exit 2). A download whose hash differs → deleted, nothing extracted (exit 3).
// The hash is not in the repo because it could not be obtained offline when this was written: take it from a copy of
// vosk-model-small-en-us-0.15.zip you trust (certutil -hashfile <zip> SHA256 · sha256sum <zip>). A network failure still
// degrades honestly (exit 0, the app ships without the microphone), as before.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MODELS_DIR = path.join(HERE, "..", "resources", "models");
export const MODEL_DIR = path.join(MODELS_DIR, "vosk-model-small-en-us");
// Official Vosk small English model (open-source, ~40 MB). Versioned dir name inside the zip differs from ours,
// so we normalize it to `vosk-model-small-en-us` after extraction.
export const MODEL_ZIP_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
export const MODEL_ZIP_NAME = "vosk-model-small-en-us-0.15.zip";
export const PIN_FILE = path.join(HERE, "vosk-model.sha256");
/** Exit codes: OK (ready / skipped / network-degraded) · NO_PIN (refused before downloading) · MISMATCH (download deleted). */
export const VOSK_EXIT = Object.freeze({ OK: 0, NO_PIN: 2, MISMATCH: 3 });

/**
 * The pinned SHA-256: VOSK_MODEL_SHA256 wins, else the first 64-hex token of scripts/vosk-model.sha256 (so a
 * `sha256sum` line works). { sha256, source: "env"|"file"|null, invalid? } — a value that is not 64 hex is invalid.
 */
export function pinnedSha256({ env = process.env, pinText = null } = {}) {
  const raw = String((env && env.VOSK_MODEL_SHA256) || "").trim();
  if (raw) return /^[A-Fa-f0-9]{64}$/.test(raw) ? { sha256: raw.toLowerCase(), source: "env" } : { sha256: null, source: "env", invalid: true };
  if (pinText != null) {
    const m = String(pinText).match(/(?:^|[^A-Fa-f0-9])([A-Fa-f0-9]{64})(?![A-Fa-f0-9])/);
    return m ? { sha256: m[1].toLowerCase(), source: "file" } : { sha256: null, source: "file", invalid: true };
  }
  return { sha256: null, source: null };
}

/** SHA-256 (hex) of a file. */
export function sha256OfFile(file, fsImpl = fs) {
  return crypto.createHash("sha256").update(fsImpl.readFileSync(file)).digest("hex");
}

function downloadHttps(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); return downloadHttps(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => { try { fs.unlinkSync(dest); } catch { /* ignore */ } reject(err); });
  });
}

function extractZip(zip, into) {
  // Use the platform's built-in extractor (no extra dependency). PowerShell on Windows, unzip elsewhere.
  const isWin = process.platform === "win32";
  const r = isWin
    ? spawnSync("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath "${zip}" -DestinationPath "${into}" -Force`], { stdio: "inherit" })
    : spawnSync("unzip", ["-o", zip, "-d", into], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("extraction failed (need PowerShell Expand-Archive on Windows or unzip elsewhere)");
}

/**
 * Fetch, VERIFY, extract. Every effect is injectable (tests pass a fake download/extract and a temp dir — never the
 * network). Returns a VOSK_EXIT code.
 */
export async function fetchModel({
  env = process.env, modelDir = MODEL_DIR, modelsDir = MODELS_DIR, pinFile = PIN_FILE,
  download = downloadHttps, extract = extractZip, fsImpl = fs, log = console.log, error = console.error
} = {}) {
  if (fsImpl.existsSync(modelDir) && fsImpl.readdirSync(modelDir).length) {
    log(`[vosk] model already present at ${modelDir} — skipping download.`);
    return VOSK_EXIT.OK;
  }
  const pinText = fsImpl.existsSync(pinFile) ? fsImpl.readFileSync(pinFile, "utf8") : null;
  const pin = pinnedSha256({ env, pinText });
  if (!pin.sha256) {
    const why = pin.invalid ? ` (${pin.source === "env" ? "VOSK_MODEL_SHA256" : "scripts/vosk-model.sha256"} is not a 64-character hex SHA-256)` : "";
    error(`[vosk] REFUSED — no pinned SHA-256 for ${MODEL_ZIP_NAME}${why}. Nothing was downloaded.`);
    error("  The model ships inside the installer, so it must match a hash you pinned first: set VOSK_MODEL_SHA256=<64 hex>,");
    error(`  or write the hash to scripts/vosk-model.sha256 — from a copy you trust (certutil -hashfile ${MODEL_ZIP_NAME} SHA256`);
    error(`  · sha256sum ${MODEL_ZIP_NAME}). Or build without on-device voice: node scripts/package-win.mjs --no-voice.`);
    return VOSK_EXIT.NO_PIN;
  }
  fsImpl.mkdirSync(modelsDir, { recursive: true });
  const zipPath = path.join(modelsDir, "vosk-model-small-en-us.zip");
  try {
    log(`[vosk] downloading ${MODEL_ZIP_URL} …`);
    await download(MODEL_ZIP_URL, zipPath);
  } catch (err) {
    try { fsImpl.unlinkSync(zipPath); } catch { /* nothing to remove */ }
    error(`[vosk] could not fetch the model: ${err && err.message}. Tap-to-speak will hide gracefully until the model is present (typing always works).`);
    return VOSK_EXIT.OK; // a network failure never fails the build — the app degrades honestly without the mic
  }
  let got = "";
  try { got = sha256OfFile(zipPath, fsImpl); } catch { got = ""; }
  if (got !== pin.sha256) {
    try { fsImpl.unlinkSync(zipPath); } catch { /* already gone */ }
    error(`[vosk] REFUSED — checksum mismatch for ${MODEL_ZIP_NAME}: pinned ${pin.sha256} (${pin.source === "env" ? "VOSK_MODEL_SHA256" : "scripts/vosk-model.sha256"}), downloaded ${got || "(unreadable)"}. The download was deleted; nothing was extracted.`);
    return VOSK_EXIT.MISMATCH;
  }
  log(`[vosk] SHA-256 verified (${got}).`);
  try {
    log("[vosk] extracting …");
    extract(zipPath, modelsDir);
    // Normalize the versioned folder name (vosk-model-small-en-us-0.15) → vosk-model-small-en-us.
    const versioned = fsImpl.readdirSync(modelsDir).find((d) => /^vosk-model-small-en-us-/.test(d));
    if (versioned) fsImpl.renameSync(path.join(modelsDir, versioned), modelDir);
    try { fsImpl.unlinkSync(zipPath); } catch { /* ignore */ }
    log(`[vosk] on-device model ready at ${modelDir}`);
  } catch (err) {
    error(`[vosk] could not extract the model: ${err && err.message}. Tap-to-speak will hide gracefully until the model is present (typing always works).`);
  }
  return VOSK_EXIT.OK;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await fetchModel());
}
