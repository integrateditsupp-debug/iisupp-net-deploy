// src/shared/admin-auth.mjs — the deployed admin-token gate IS the app's module.
//
// SENTINEL-BACKEND 2026-10-14 (audit B13 / RUN-CU P1 #10). The root copy accepted ONLY SENTINEL_ADMIN_TOKEN while
// the app's accepts SENTINEL_ADMIN_TOKEN and ARIA_ADMIN_TOKEN (constant-time, per candidate) — whichever env
// name a deploy had set, one of the two copies answered 401. Re-exporting the app module keeps the return
// shape ({ ok, status, reason }) and the export name; `adminTokenMatch` / ADMIN_TOKEN_ENV_NAMES come along.
export { requireAdminToken, adminTokenMatch, ADMIN_TOKEN_ENV_NAMES } from "../../ARIA Sentinel/src/shared/admin-auth.mjs";
