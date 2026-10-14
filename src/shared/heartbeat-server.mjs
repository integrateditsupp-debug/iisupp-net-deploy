// src/shared/heartbeat-server.mjs — the deployed heartbeat logic IS the app's module.
//
// SENTINEL-BACKEND 2026-10-14 (audit B10). This file used to be a self-described stub with a different
// response shape ({licenseActive} instead of the app's {valid, advisoryMessage, nextCheckIn}), a `live===true`
// filter no published version ever satisfied (publish writes `disabled:false`), and a license lookup by the
// first 16 characters of the raw key. The app's tests exercised the real module while Netlify deployed this one.
// Re-exporting the app module (Rule 15 consolidation — every previous export name still exists) means the
// deployed function and the tested module can no longer drift. The netlify handler adds `licenseActive`
// (the stub's field) on top so any reader of the old shape keeps working.
export { heartbeatResponse, sanitizeHeartbeatRecord, heartbeatStoreKey, latestLiveVersion } from "../../ARIA Sentinel/src/shared/heartbeat-server.mjs";
