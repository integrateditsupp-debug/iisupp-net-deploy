// TRUE on-device offline speech-to-text for the companion's tap-to-speak — Vosk (open-source, $0). The audio
// AND the transcription stay 100% on the machine: the mic stream is decoded in-process by the bundled Vosk WASM
// engine against a locally-bundled en-US model (shipped as an extraResource; see scripts/fetch-vosk-model.mjs).
// NOTHING leaves the device — there is no network call and NO cloud recognizer fallback anywhere in this path.
//
// Everything is lazy + guarded: the engine load, the model load, and getUserMedia all happen inside
// createLocalStt(). If ANY of them is unavailable (no engine, no bundled model, no mic), it throws a coded error
// and the caller says "voice isn't available on this install" — typing always works and we NEVER silently fall
// back to a cloud recognizer.
//
// PROD 2026-10-14 (audit R12) — HOW THE ENGINE LOADS. `vosk-browser` ships a UMD bundle (dist/vosk.js), not an
// ES module, and the renderer runs under file:// with nodeIntegration:false, so a bare `import("vosk-browser")`
// can never resolve (Chromium: "Failed to resolve module specifier"). The engine is therefore loaded as a classic
// script from its RELATIVE path inside the app bundle (node_modules ships with the production dependencies), which
// `script-src 'self'` allows under file://; it defines globalThis.Vosk. If that file is missing on an install, the
// load fails fast with "stt-no-engine" and the UI says so — never a vanishing microphone.
//
// The model is referenced only as a local file:// URL (resolved by main from the bundled resource path); this
// file intentionally contains no http(s) host, so the privacy audit stays green.

export const VOSK_PACKAGE = "vosk-browser"; // the offline Vosk WASM build (package.json production dependency)
export const VOSK_ENGINE_PATHS = Object.freeze([
  `../../node_modules/${VOSK_PACKAGE}/dist/vosk.js`, // inside app.asar: src/renderer → node_modules (production dependency)
  "./vendor/vosk.js"                                 // optional vendored copy (same file, no new dependency)
]);

let enginePromise = null;

/** Resolve the Vosk engine object ({ createModel }) once; throws Error("stt-no-engine") when it cannot load. */
export function loadVoskEngine({ paths = VOSK_ENGINE_PATHS, doc = typeof document !== "undefined" ? document : null } = {}) {
  if (typeof globalThis !== "undefined" && globalThis.Vosk && typeof globalThis.Vosk.createModel === "function") return Promise.resolve(globalThis.Vosk);
  if (enginePromise) return enginePromise;
  if (!doc) return Promise.reject(new Error("stt-no-engine"));
  enginePromise = (async () => {
    for (const rel of paths) {
      const ok = await new Promise((resolve) => {
        try {
          const s = doc.createElement("script");
          s.src = new URL(rel, import.meta.url).href;
          s.async = true;
          s.onload = () => resolve(true);
          s.onerror = () => { try { s.remove(); } catch { /* ignore */ } resolve(false); };
          doc.head.appendChild(s);
        } catch { resolve(false); }
      });
      if (ok && globalThis.Vosk && typeof globalThis.Vosk.createModel === "function") return globalThis.Vosk;
    }
    throw new Error("stt-no-engine");
  })();
  enginePromise.catch(() => { enginePromise = null; }); // a later tap may retry (e.g. after an install repair)
  return enginePromise;
}

/** Plain words for a createLocalStt failure code (Rule 14 — the exact reason, never a vanished control). */
export function sttUnavailableReason(err) {
  const code = err && err.message ? String(err.message) : "";
  if (code === "stt-no-model") return "Voice isn't available on this install — the on-device speech model is not bundled. Typing works.";
  if (code === "stt-no-mic") return "Voice isn't available here — no microphone access. Typing works.";
  if (code === "stt-no-engine") return "Voice isn't available on this install — the on-device speech engine could not load. Typing works.";
  if (/NotAllowedError|Permission/i.test(code)) return "Microphone access was denied — allow it in Windows privacy settings to use voice. Typing works.";
  return "Voice isn't available right now. Typing works.";
}

/**
 * Start on-device recognition. Resolves to a controller { stop() } once the mic is live, or throws if the local
 * engine / model / mic is unavailable. onText(transcript) fires for each final result. The mic is OFF until this
 * is called and is fully released by stop().
 */
export async function createLocalStt({ modelUrl, onText } = {}) {
  if (!modelUrl) throw new Error("stt-no-model");
  if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("stt-no-mic");
  }
  // Lazy engine load so a missing bundle simply disables voice with a reason — never a hard crash.
  const vosk = await loadVoskEngine();
  const model = await vosk.createModel(modelUrl);            // loads the LOCAL model (file:// URL); no network
  const recognizer = new model.KaldiRecognizer(16000);
  recognizer.on("result", (message) => {
    const text = message && message.result && message.result.text;
    if (text && typeof onText === "function") onText(text.trim());
  });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // mic ON only now
  const AudioCtx = window.AudioContext;
  const audioCtx = new AudioCtx({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);
  const node = audioCtx.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (event) => { try { recognizer.acceptWaveform(event.inputBuffer); } catch { /* frame drop is non-fatal */ } };
  source.connect(node);
  node.connect(audioCtx.destination);

  let stopped = false;
  return {
    stop() {
      if (stopped) return; stopped = true;
      try { node.disconnect(); source.disconnect(); } catch { /* already gone */ }
      try { stream.getTracks().forEach((track) => track.stop()); } catch { /* mic already released */ } // mic OFF
      try { audioCtx.close(); } catch { /* ctx already closed */ }
      try { recognizer.remove && recognizer.remove(); } catch { /* best-effort */ }
      try { model.terminate && model.terminate(); } catch { /* best-effort */ }
    }
  };
}
