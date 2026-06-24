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
 * endpoint can never block startup. Pure except for the injected sender.
 */
export async function flushCrashQueue(queue, sendFn) {
  const remaining = [];
  for (const rec of Array.isArray(queue) ? queue : []) {
    let ok = false;
    try { ok = (await sendFn(rec)) === true; } catch { ok = false; }
    if (!ok) remaining.push(rec);
  }
  return remaining;
}

// ── Thin Electron/IO wiring (not unit-tested; the decisions above are) ───────────────────────────────────
// Wire from main.mjs:
//   import { installCrashReporter } from "./crash-reporter.mjs";
//   installCrashReporter({ version: SENTINEL_VERSION, crashFile: path.join(os.homedir(), ".aria-sentinel", "crash.log"),
//                          endpoint: "https://iisupp.net/.netlify/functions/sentinel-crash", fs, log: logEvent });
export function installCrashReporter({ version, crashFile, endpoint, fs, process: proc = process, log = () => {} } = {}) {
  const read = () => { try { return JSON.parse(fs.readFileSync(crashFile, "utf8")); } catch { return []; } };
  const write = (q) => { try { fs.mkdirSync(crashFile.replace(/[\\/][^\\/]+$/, ""), { recursive: true }); fs.writeFileSync(crashFile, JSON.stringify(q, null, 2)); } catch { /* best-effort */ } };

  const capture = (error) => {
    try {
      const rec = buildCrashRecord(error, { version, platform: proc.platform });
      write(enqueueCrash(read(), rec));
      log("CRASH", "Crash captured locally (content-blind).");
    } catch { /* never throw from the handler */ }
  };
  proc.on("uncaughtException", capture);
  proc.on("unhandledRejection", (r) => capture(r instanceof Error ? r : new Error(String(r))));

  // On launch, flush whatever queued — best-effort, off the UI path, never blocks.
  const send = async (rec) => {
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "user-agent": "aria-sentinel" }, body: JSON.stringify(rec) });
      return res.ok;
    } catch { return false; }
  };
  Promise.resolve().then(async () => {
    const queue = read();
    if (!queue.length) return;
    write(await flushCrashQueue(queue, send));
  }).catch(() => {});

  return { capture };
}
