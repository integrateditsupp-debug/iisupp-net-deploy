import assert from "node:assert/strict";
import { matchRecipes, recipeById, RECIPES, STOP_CODES } from "../src/shared/recipes.mjs";

const cases = [
  ["C drive has only 3% free and Windows says disk full", "disk-low-space-v1"],
  ["DNS error ERR_NAME_NOT_RESOLVED website will not load", "dns-fail-v1"],
  ["WiFi connected but no internet and I see 169.254 address", "wifi-no-internet-v1"],
  ["printer offline print queue stuck spooler", "printer-spooler-v1"],
  ["Teams is stuck loading and will not sign in", "teams-cache-v1"],
  ["This page looks stale and old content keeps showing", "browser-cache-stale-v1"],
  ["service worker stuck offline page after deployment", "service-worker-stuck-v1"],
  ["I entered my password twice and login failed again", "browser-password-loop-v1"],
  ["page zoom weird everything is too big", "zoom-weird-v1"],
  ["blue screen CRITICAL_PROCESS_DIED stop code 0x000000EF", "bsod-critical-process-v1"],
  ["ARIA Sentinel javascript error main process EADDRINUSE port 37841", "sentinel-self-repair-v1"],
  ["outlook ost corrupt and outlook sync stuck", "outlook-ost-repair-v1"],
  ["windows update stuck installing updates failed", "windows-update-stuck-v1"],
  ["onedrive sync stuck processing files", "onedrive-sync-stuck-v1"],
  ["vpn connect fail tunnel gateway", "vpn-connect-fail-v1"],
  ["office activation failed microsoft 365 unlicensed", "m365-activation-fail-v1"],
  ["no audio output speaker missing", "audio-no-output-v1"],
  ["camera blocked microphone permission", "media-permission-blocked-v1"],
  ["defender signatures stale antivirus out of date", "defender-stale-v1"],
  ["chrome tab crash aw snap browser crash loop", "browser-tab-crash-loop-v1"],
  ["download blocked unsafe download failed", "browser-download-blocked-v1"],
  ["certificate expired net::err_cert_date_invalid clock wrong", "browser-cert-expired-v1"],
  ["mixed content insecure content https warning", "browser-mixed-content-v1"],
  ["extension conflict ad blocker broke site", "browser-extension-conflict-v1"],
  ["site slow ttfb page takes forever", "browser-slow-load-v1"],
  // RUN 7 — 23 new recipes (25 → 50)
  ["the print spooler not running spooler service stopped", "svc-spooler-stopped-v1"],
  ["windows audio service stopped on this machine", "svc-audiosrv-stopped-v1"],
  ["bits service stopped background intelligent transfer stopped", "svc-bits-stopped-v1"],
  ["windows update service stopped on this pc", "svc-wuauserv-stopped-v1"],
  ["dns client service stopped names not resolving", "svc-dnscache-stopped-v1"],
  ["wlan autoconfig service stopped wifi list empty", "svc-wlansvc-stopped-v1"],
  ["workstation service stopped shares unavailable", "svc-workstation-stopped-v1"],
  ["remote access service stopped tunnel will not start", "svc-rasman-stopped-v1"],
  ["cpu sustained high and fan is loud", "system-high-cpu-v1"],
  ["high ram usage everything is swapping", "system-high-ram-v1"],
  ["computer rebooted unexpectedly overnight", "bsod-unexpected-shutdown-v1"],
  ["whea uncorrectable error in the event log", "hardware-whea-v1"],
  ["smart failure predicted disk is failing", "disk-hardware-fault-v1"],
  ["outlook profile corrupt cannot open profile", "outlook-profile-corrupt-v1"],
  ["onedrive storage full quota exceeded", "onedrive-storage-full-v1"],
  ["autofill wrong address on the form", "browser-autofill-wrong-v1"],
  ["ad blocker breaking page during checkout", "browser-adblock-break-v1"],
  ["printer driver stuck and driver crash", "printer-driver-stuck-v1"],
  ["cookies blocked site needs cookies enabled", "browser-cookies-blocked-v1"],
  ["popup blocked allow popups this site", "browser-popup-blocked-v1"],
  ["system clock drift windows time out of sync", "system-time-drift-v1"],
  ["proxy misconfigured wrong proxy settings", "net-proxy-misconfig-v1"],
  ["download stuck pending not finishing", "browser-download-stuck-v1"],
  // RUN 8 — 25 long-tail recipes (50 → 75)
  ["excel not responding and hangs on open", "app-excel-hang-v1"],
  ["word not responding word frozen", "app-word-hang-v1"],
  ["chrome profile locked profile in use", "app-chrome-profile-locked-v1"],
  ["edge sync broken not syncing", "app-edge-sync-broken-v1"],
  ["wifi weak signal keeps dropping", "net-wifi-weak-v1"],
  ["ethernet cable unplugged no link", "net-ethernet-unplugged-v1"],
  ["captive portal won't load on hotel wifi", "net-captive-portal-v1"],
  ["microphone not detected on calls", "audio-mic-not-detected-v1"],
  ["second monitor blank not detected", "display-second-monitor-blank-v1"],
  ["screen resolution wrong and stretched", "display-resolution-wrong-v1"],
  ["keyboard typing wrong characters layout changed", "input-keyboard-layout-v1"],
  ["touchpad not working disabled", "input-touchpad-disabled-v1"],
  ["pdf won't open in adobe reader", "app-pdf-wont-open-v1"],
  ["zoom no audio in the meeting", "app-zoom-no-audio-v1"],
  ["teams camera black screen", "app-teams-camera-black-v1"],
  ["bitlocker recovery key prompt at boot", "security-bitlocker-recovery-v1"],
  ["firewall blocking application connection", "security-firewall-block-v1"],
  ["usb drive not recognized not showing", "storage-usb-not-recognized-v1"],
  ["cannot eject external drive in use", "storage-eject-fail-v1"],
  ["windows startup very slow boot", "system-startup-slow-v1"],
  ["windows search not working broken", "system-search-broken-v1"],
  ["start menu not opening start button not working", "system-start-menu-broken-v1"],
  ["office stuck updating microsoft 365 stuck updating", "app-m365-stuck-updating-v1"],
  ["page translate not working in browser", "browser-translate-broken-v1"],
  ["browser not saving passwords prompt missing", "browser-password-not-saving-v1"],
  // RUN 11 — patch management
  ["updates available patch available for chrome", "patch-available-v1"],
  // RUN 13 — internet-down troubleshooter
  ["internet seems down cannot reach the internet", "net-down-troubleshoot-v1"]
];

for (const [query, expectedId] of cases) {
  const [top] = matchRecipes(query, { limit: 1 });
  assert.ok(top, `expected a match for: ${query}`);
  assert.equal(top.recipe.id, expectedId, `query "${query}" should match ${expectedId}`);
}

for (const recipe of RECIPES) {
  assert.ok(recipe.id, "recipe has id");
  assert.ok(recipe.signal, `${recipe.id} has signal`);
  assert.ok(recipe.title, `${recipe.id} has title`);
  assert.ok(["green", "yellow", "orange", "red"].includes(recipe.risk), `${recipe.id} has known risk`);
  assert.ok(Array.isArray(recipe.actions), `${recipe.id} has actions array`);
}

assert.equal(recipeById("dns-fail-v1").actions[0].command, "ipconfig /flushdns");
assert.equal(STOP_CODES.length, 25, "local MVP stop-code catalog should contain 25 mappings");

console.log(`Scenario suite passed (${cases.length} scenarios, ${RECIPES.length} recipes, ${STOP_CODES.length} stop codes).`);
