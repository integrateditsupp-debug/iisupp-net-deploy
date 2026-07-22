// axis-constants.mjs — worker-side view of the AXIS CC v2 vocabulary.
// Re-exports BOTH halves so worker/snapshots/DB code sees one namespace and can never drift:
//   assets/axis-constants.js          — PUBLIC UI vocabulary (rides the browser module graph)
//   scripts/lib/axis-private-constants.mjs — OPERATOR-INTERNAL (template/identity/pacing/Blobs; force-404'd)
// Do NOT redefine enums here, and NEVER import the private half from a browser-served asset.
export * from '../../assets/axis-constants.js';
export * from './axis-private-constants.mjs';
