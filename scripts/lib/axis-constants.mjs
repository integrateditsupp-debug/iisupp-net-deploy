// axis-constants.mjs — worker-side view of the AXIS CC v2 vocabulary.
// Re-exports the SINGLE source in assets/axis-constants.js so the worker, snapshots, DB schema, and
// the browser page can never drift. Do NOT redefine enums here — edit assets/axis-constants.js.
export * from '../../assets/axis-constants.js';
