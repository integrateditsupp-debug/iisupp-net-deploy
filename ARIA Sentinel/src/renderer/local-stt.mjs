// TRUE on-device offline speech-to-text for the companion's tap-to-speak — Vosk (open-source, $0). The audio
// AND the transcription stay 100% on the machine: the mic stream is decoded in-process by the bundled Vosk WASM
// engine against a locally-bundled en-US model (shipped as an extraResource; see scripts/fetch-vosk-model.mjs).
// NOTHING leaves the device — there is no network call and NO cloud recognizer fallback anywhere in this path.
//
// Everything is lazy + guarded: the `vosk-browser` import, the model load, and getUserMedia all happen inside
// createLocalStt(). If ANY of them is unavailable (no engine, no bundled model, no mic), it throws and the caller
// hides the mic button — typing always works and we NEVER silently fall back to a cloud recognizer.
//
// The model is referenced only as a local file:// URL (resolved by main from the bundled resource path); this
// file intentionally contains no http(s) host, so the privacy audit stays green.

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
  // Lazy import so a missing dependency simply disables the mic (caller hides the button) — never a hard crash.
  const vosk = await import("vosk-browser");
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
