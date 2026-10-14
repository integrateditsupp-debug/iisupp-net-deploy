// src/shared/update-manifest.mjs — the deployed update-feed logic IS the app's module.
//
// SENTINEL-BACKEND 2026-10-14 (audit B13 / B20). The root copy had drifted from the app's: it dropped the
// record's `url` (so a version published with a GitHub-Releases / download.iisupp.net URL was served as
// https://iisupp.net/sentinel-binaries/<file> regardless), and the two copies could disagree on what a
// "latest" version is. One module, no literals here — no version, no host, no file name is hard-coded in
// this file; the published version record carries all of it. Every previous export name still exists.
export { pickVersionForLicense, buildLatestYml, inRollout } from "../../ARIA Sentinel/src/shared/update-manifest.mjs";
