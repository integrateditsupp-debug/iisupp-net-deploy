// Build-time helper — download the small offline en-US Vosk model that ships with the app (extraResources) so
// tap-to-speak runs 100% ON-DEVICE. This is a DEVELOPER/BUILD step (run by `npm run prepackage`), NOT app code:
// it is never bundled and never runs on a user's machine. The model itself is ~40 MB and adds ~40-50 MB to the
// installer (honest size note); it is intentionally NOT committed to git (see .gitignore) to keep the repo lean.
//
// At runtime the app makes NO network call for speech — it loads this locally-bundled model as a file:// URL and
// transcribes in-process (see src/renderer/local-stt.mjs). Only this build script touches the network, and only
// to fetch the model from Vosk's official distribution.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(HERE, "..", "resources", "models");
const MODEL_DIR = path.join(MODELS_DIR, "vosk-model-small-en-us");
// Official Vosk small English model (open-source, ~40 MB). Versioned dir name inside the zip differs from ours,
// so we normalize it to `vosk-model-small-en-us` after extraction.
const MODEL_ZIP_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
const ZIP_PATH = path.join(MODELS_DIR, "vosk-model-small-en-us.zip");

if (fs.existsSync(MODEL_DIR) && fs.readdirSync(MODEL_DIR).length) {
  console.log(`[vosk] model already present at ${MODEL_DIR} — skipping download.`);
  process.exit(0);
}
fs.mkdirSync(MODELS_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => { try { fs.unlinkSync(dest); } catch { /* ignore */ } reject(err); });
  });
}

function extract(zip, into) {
  // Use the platform's built-in extractor (no extra dependency). PowerShell on Windows, unzip elsewhere.
  const isWin = process.platform === "win32";
  const r = isWin
    ? spawnSync("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath "${zip}" -DestinationPath "${into}" -Force`], { stdio: "inherit" })
    : spawnSync("unzip", ["-o", zip, "-d", into], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("extraction failed (need PowerShell Expand-Archive on Windows or unzip elsewhere)");
}

try {
  console.log(`[vosk] downloading ${MODEL_ZIP_URL} …`);
  await download(MODEL_ZIP_URL, ZIP_PATH);
  console.log("[vosk] extracting …");
  extract(ZIP_PATH, MODELS_DIR);
  // Normalize the versioned folder name (vosk-model-small-en-us-0.15) → vosk-model-small-en-us.
  const versioned = fs.readdirSync(MODELS_DIR).find((d) => /^vosk-model-small-en-us-/.test(d));
  if (versioned) fs.renameSync(path.join(MODELS_DIR, versioned), MODEL_DIR);
  try { fs.unlinkSync(ZIP_PATH); } catch { /* ignore */ }
  console.log(`[vosk] on-device model ready at ${MODEL_DIR}`);
} catch (err) {
  console.error(`[vosk] could not fetch the model: ${err && err.message}. Tap-to-speak will hide gracefully until the model is present (typing always works).`);
  process.exit(0); // never fail the build — the app degrades honestly without the mic
}
