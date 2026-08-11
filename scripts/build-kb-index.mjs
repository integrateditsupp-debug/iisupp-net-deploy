#!/usr/bin/env node
/**
 * build-kb-index.mjs — DEFECT-220 repoint (Sentinel watcher run179, 2026-08-06).
 *
 * `npm run kb:build` has always pointed here, but the file was never committed
 * (verified first-hand: `git log -- scripts/build-kb-index.mjs` is empty), so the
 * script exited with MODULE_NOT_FOUND.
 *
 * The current, real KB index builder is `scripts/build-kb-bundle.mjs`, which walks
 * `knowledge-base/` and writes `assets/aria-kb-local-bundle.json`.
 *
 * Per RULE 15 (preserve everything) the `kb:build` npm entry name is kept intact;
 * this file is a thin, honest delegator to the real builder — no logic duplicated,
 * no behaviour invented.
 */
import "./build-kb-bundle.mjs";
