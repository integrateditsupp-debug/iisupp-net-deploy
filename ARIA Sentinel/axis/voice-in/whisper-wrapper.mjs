// axis/voice-in/whisper-wrapper.mjs — STUB (RUN A · Phase 1 scaffold)
// Purpose: spawn a LOCAL Whisper binary (privacy-preserving, no cloud transcription) and return the
// transcript text for a recorded audio clip. Local-only keeps audio off the network and within the
// spend cap (no paid transcription API).
//
// NOT WIRED YET: Whisper is NOT installed this run (spend-cap / no-new-deps rule). This stub only
// defines the contract; Phase 1 implementation will shell out to a whisper.cpp / faster-whisper binary
// discovered on PATH or bundled under resources.

export const WHISPER_NOT_INSTALLED = "whisper-binary-not-found";

/**
 * Transcribe a local audio file to text using a local Whisper binary.
 * @param {string} _audioPath path to a wav/mp3 clip on disk
 * @param {object} _opts { model?, language?, binaryPath?, spawnImpl? }
 * @returns {Promise<{ text: string, ok: boolean, reason?: string }>}
 */
export async function transcribe(_audioPath, _opts = {}) {
  // TODO(phase-1): locate the whisper binary; spawn it on _audioPath; parse stdout → transcript text.
  // Must run fully offline. Never upload audio. Return { ok:false, reason:WHISPER_NOT_INSTALLED } if absent.
  throw new Error("AXIS whisper-wrapper: not implemented (Phase 1 stub)");
}

/** Check whether a local Whisper binary is available (no spend, no network). */
export async function whisperAvailable(_opts = {}) {
  // TODO(phase-1): probe PATH / bundled resources for a whisper binary; return boolean.
  return false;
}
