// RUN 29-D — $0 crash reporter. On an uncaught error the main process writes a SCRUBBED crash record to
// ~/.aria-sentinel/crash.log (a JSON queue); on the next launch it best-effort forwards the queue to
// /.netlify/functions/sentinel-crash and keeps anything that failed to send (retry next launch). It NEVER
// blocks the UI and NEVER sends file contents, screen pixels, or raw filesystem paths.
//
// 🔒 R11 / privacy: every text field passes scrubCrashText() — the "Private pics and Vids" folder is redacted
// to <private-folder>, and every absolute path (Windows drive paths, POSIX /Users|/home|… , file:// URLs) is
// replaced with [path] before anything is written or sent. Only symbolic error metadata leaves the device.
import { redactPrivate } from "../shared/path-guard.mjs";

export const CRASH_QUEUE_MAX = 50;
// PROD 2026-10-14 (audit M17) — a record that failed to send this many times is dropped (logged locally), so a
// dead endpoint or a malformed record cannot be retried on every launch for ever.
export const CRASH_SEND_MAX_ATTEMPTS = 5;

/** Scrub a message/stack: R11 folder first, then strip every absolute path + file:// URL to a placeholder. */
export function scrubCrashText(text) {
  let s = redactPrivate(String(text == null ? "" : text)); // 🔒 R11 → <private-folder>
  s = s
    .replace(/file:\/\/\/?[^\s"')]+/gi, "[path]")              // file:// URLs in stacks
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")               // Windows absolute paths
    .replace(/\/(?:Users|home|mnt|var|tmp|opt|private)\/[^\s"'()]+/gi, "[path]"); // POSIX absolute paths
  return s;
}

/**
 * Build a content-blind crash record from an error. Carries ONLY symbolic metadata: scrubbed name/message,
 * a scrubbed + truncated stack (≤20 frames), the app version + platform, and a timestamp. No file contents.
 */
export function buildCrashRecord(error, meta = {}) {
  const e = error || {};
  const stack = scrubCrashText(e.stack || "").split(/\r?\n/).slice(0, 20).join("\n").slice(0, 4000);
  return {
    ts: meta.now || Date.now(),
    name: scrubCrashText(e.name || (e.constructor && e.constructor.name) || "Error").slice(0, 120),
    message: scrubCrashText(e.message != null ? e.message : String(e)).slice(0, 500),
    stack,
    version: String(meta.version || "0.0.0"),
    platform: String(meta.platform || "")
  };
}

/** Append a record to the bounded crash queue (oldest dropped past CRASH_QUEUE_MAX). Pure. */
export function enqueueCrash(queue, record, max = CRASH_QUEUE_MAX) {
  const list = Array.isArray(queue) ? queue.slice() : [];
  list.push(record);
  return list.slice(-max);
}

/**
 * Forward the queue via an injected async sendFn(record) => boolean. Returns the records that did NOT send
 * (kept for the next launch — retry-on-failure). A throwing/false sendFn never throws out of here, so a dead
 * endpoint can never block startup. Each failure counts an attempt; past `maxAttempts` the record is dropped
 * (the retry ceiling — audit M17). Pure except for the injected sender.
 */
export async function flushCrashQueue(queue, sendFn, { maxAttempts = CRASH_SEND_MAX_ATTEMPTS, onDrop } = {}) {
  const remaining = [];
  for (const rec of Array.isArray(queue) ? queue : []) {
    let ok = false;
    try { ok = (await sendFn(rec)) === true; } catch { ok = false; }
    if (ok) continue;
    const attempts = (Number(rec && rec.attempts) || 0) + 1;
    if (attempts >= maxAttempts) { if (typeof onDrop === "function") { try { onDrop(rec, attempts); } catch { /* never throw */ } } continue; }
    remaining.push({ ...rec, attempts });
  }
  return remaining;
}

// ── Thin Electron/IO wiring (not unit-tested; the decisions above are) ───────────────────────────────────
// Wire from main.mjs:
//   import { installCrashReporter } from "./crash-reporter.mjs";
//   installCrashReporter({ version: SENTINEL_VERSION, crashFile: path.join(os.homedir(), ".aria-sentinel", "crash.log"),
//                          endpoint: "https://iisupp.net/.netlify/functions/sentinel-crash", fs, log: logEvent });
// PROD 2026-10-14 (audit M17): `fetchImpl` is main's outbound wrapper (so the privacy verifier sees the send and the
// allowlist is enforced), `canSend()` is the consent gate (setup completed) — before consent the queue only grows
// locally — and `flush()` lets main send the queue once consent arrives. `headers()` supplies the device credential.
export function installCrashReporter({ version, crashFile, endpoint, fs, process: proc = process, log = () => {}, fetchImpl, canSend, headers, maxAttempts = CRASH_SEND_MAX_ATTEMPTS } = {}) {
  const read = () => { try { return JSON.parse(fs.readFileSync(crashFile, "utf8")); } catch { return []; } };
  const write = (q) => { try { fs.mkdirSync(crashFile.replace(/[\\/][^\\/]+$/, ""), { recursive: true }); fs.writeFileSync(crashFile, JSON.stringify(q, null, 2)); } catch { /* best-effort */ } };
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : (typeof fetch === "function" ? fetch : null);
  const allowed = () => { try { return typeof canSend === "function" ? canSend() === true : true; } catch { return false; } };

  const capture = (error) => {
    try {
      const rec = buildCrashRecord(error, { version, platform: proc.platform });
      write(enqueueCrash(read(), rec));
      log("CRASH", "Crash captured locally (content-blind).");
    } catch { /* never throw from the handler */ }
  };
  proc.on("uncaughtException", capture);
  proc.on("unhandledRejection", (r) => capture(r instanceof Error ? r : new Error(String(r))));

  const send = async (rec) => {
    if (!doFetch) return false;
    try {
      const extra = typeof headers === "function" ? (headers() || {}) : {};
      const { attempts, ...body } = rec || {}; // the local attempt counter never leaves the device
      const res = await doFetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "user-agent": "aria-sentinel", ...extra }, body: JSON.stringify(body) });
      return Boolean(res && res.ok);
    } catch { return false; }
  };
  let flushing = false;
  const flush = async () => {
    if (flushing || !allowed()) return { sent: 0, remaining: read().length, skipped: !allowed() };
    flushing = true;
    try {
      const queue = read();
      if (!queue.length) return { sent: 0, remaining: 0 };
      const remaining = await flushCrashQueue(queue, send, { maxAttempts, onDrop: () => log("CRASH", `Crash record dropped after ${maxAttempts} failed send attempts (kept nowhere else).`) });
      write(remaining);
      return { sent: queue.length - remaining.length, remaining: remaining.length };
    } finally { flushing = false; }
  };
  // On launch, flush whatever queued — best-effort, off the UI path, never blocks — ONLY once the person consented.
  Promise.resolve().then(flush).catch(() => {});

  return { capture, flush };
}
