// axis/voice-in/transcript-router.mjs — STUB (RUN A · Phase 1 scaffold)
// Purpose: take a Whisper transcript, classify which brain region it concerns (the vault is organized
// like a brain — see aria-vault/00_Index/Brain-Map.md), read that region via brain-bridge, and dispatch
// the query to Cowork's brain. Mirrors how a brain routes input through the thalamus to the right lobe.

// Brain regions AXIS can route to (matches brain_region frontmatter in the vault).
export const REGIONS = [
  "frontal", "frontal-iis", "frontal-aria", "frontal-sentinel", "frontal-decisions",
  "hippocampus", "basal-ganglia", "short-term", "thalamus", "cerebellum",
  "cortex", "cortex-frontal", "cortex-association", "amygdala", "brainstem",
  "corpus-callosum", "glia"
];

/**
 * Classify a transcript to the most relevant brain region(s).
 * @param {string} _transcript spoken text from whisper-wrapper
 * @returns {{ region: string, confidence: number }}
 */
export function classifyRegion(_transcript) {
  // TODO(phase-1): keyword/intent map → region (e.g. "what's the rule on…" → hippocampus,
  // "any alerts" → amygdala, "is everything healthy" → brainstem, "who is…" → cortex).
  throw new Error("AXIS transcript-router: classifyRegion not implemented (Phase 1 stub)");
}

/**
 * Route a transcript end-to-end: classify → read region (brain-bridge) → dispatch to Cowork → reply.
 * @param {string} _transcript
 * @param {object} _deps { vaultReader, memoryReader, dispatch }
 * @returns {Promise<{ region: string, reply: string }>}
 */
export async function routeTranscript(_transcript, _deps = {}) {
  // TODO(phase-1): classifyRegion → vaultReader.readByRegion → build prompt → dispatch → spoken reply.
  // Spoken replies stay under ~12 words (caveman comms); long-form goes to the vault.
  throw new Error("AXIS transcript-router: routeTranscript not implemented (Phase 1 stub)");
}
