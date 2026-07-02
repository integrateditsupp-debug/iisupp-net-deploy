// Walk-through step source — ONE shared, node-free definition the desktop Walk-through tab renders and that
// mirrors the web aria.html KB `walk:[{title, sub, screenshot}]` shape (same step model, same field names).
//
// REAL-OR-EMPTY (Rule 14): only issues with genuinely authored manual steps appear here. Every step below is
// the real, verifiable manual equivalent of what the gated fix does — nothing invented. A recipe with no
// authored steps returns [] so the UI shows an HONEST fallback (verified KB article + gated-resolve option),
// never a fabricated or blank walk. Screenshots are intentionally omitted (real-or-empty — we do not ship
// fake device captures); the renderer degrades to title + sub cleanly where `screenshot` is absent.
//
// GUIDE MODE IS PURE DISPLAY: following these steps changes NOTHING on the machine. The only thing that ever
// changes a PC is the separately-gated "Resolve it for me" apply flow (supervisor + countdown + tier-0 +
// kill-switch + rollback). This module has no side effects and touches nothing on disk.

// Canonical step lists keyed by executor id (the 5 vetted Tier-0 bindings) + the registry recipe ids the web
// handoff maps. Each `sub` is the concrete manual action; a user could do it by hand with no automation.
export const WALK_STEPS = Object.freeze({
  // ── Vetted Tier-0 executor bindings (these have a safe, reversible auto-apply) ──────────────────────────
  "restart-print-spooler": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Print Spooler”", sub: "Scroll the alphabetical list down to the P section." },
    { title: "Restart the service", sub: "Right-click Print Spooler → Restart. Stuck jobs clear and the queue resets." },
    { title: "Try printing again", sub: "Send a test page — pending jobs resume on the restarted spooler." }
  ],
  "restart-windows-update": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Windows Update”", sub: "It sits near the bottom of the list (service name wuauserv)." },
    { title: "Restart the service", sub: "Right-click Windows Update → Restart to clear a stuck update agent." },
    { title: "Re-check for updates", sub: "Settings → Windows Update → Check for updates." }
  ],
  "flush-dns-cache": [
    { title: "Open Command Prompt", sub: "Press Win+R, type cmd, and press Enter." },
    { title: "Flush the resolver cache", sub: "Type  ipconfig /flushdns  and press Enter." },
    { title: "Confirm the flush", sub: "You should see “Successfully flushed the DNS Resolver Cache.”" },
    { title: "Reload the page", sub: "Try the site again — stale DNS entries are gone." }
  ],
  "restart-bluetooth": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Bluetooth Support Service”", sub: "Service name bthserv." },
    { title: "Restart the service", sub: "Right-click → Restart to reset the Bluetooth stack." },
    { title: "Re-pair if needed", sub: "Settings → Bluetooth & devices — reconnect your device." }
  ],
  "restart-audio": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Windows Audio”", sub: "Service name Audiosrv." },
    { title: "Restart the service", sub: "Right-click → Restart to recover a hung audio engine." },
    { title: "Test sound", sub: "Play any audio to confirm output is back." }
  ],
  // ── Registry recipes the web handoff maps (guidance mirrors the recipe summary; not all auto-apply yet) ──
  "printer-spooler-v1": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Restart Print Spooler", sub: "Right-click Print Spooler → Restart to clear the stuck queue." },
    { title: "Re-add the printer if it stays offline", sub: "Settings → Bluetooth & devices → Printers & scanners." },
    { title: "Print a test page", sub: "Confirm the job completes end-to-end." }
  ],
  "wifi-no-internet-v1": [
    { title: "Open Network & internet settings", sub: "Right-click the network icon in the tray → Network & internet settings." },
    { title: "Toggle the adapter off, then on", sub: "Disable Wi-Fi, wait 5 seconds, re-enable it to force a fresh handshake." },
    { title: "Renew the connection", sub: "Reconnect to your network; Windows requests a new IP address." },
    { title: "Verify you're online", sub: "Open a website — if it loads, the connection is restored." }
  ],
  "disk-low-space-v1": [
    { title: "Open Storage settings", sub: "Settings → System → Storage." },
    { title: "Run Cleanup recommendations", sub: "Review temporary files and old downloads Windows flags as safe to remove." },
    { title: "Clear browser cache", sub: "In your browser: Settings → Privacy → Clear cached images and files." },
    { title: "Re-check free space", sub: "Confirm the drive now has headroom before installing or updating." }
  ],
  "browser-password-loop-v1": [
    { title: "Confirm the exact sign-in behavior", sub: "Wrong-password error, an endless redirect, or an MFA prompt that never completes?" },
    { title: "Clear the site's saved sign-in", sub: "Browser Settings → Privacy → clear cookies for that one site (credentials are not touched)." },
    { title: "Retry the sign-in", sub: "Open the site fresh and sign in again." },
    { title: "Reset the password if it still fails", sub: "Use the provider's official “Forgot password” flow — never share it with anyone." }
  ]
});

// Intent / alias id → canonical step key, so a web intent (e.g. "printer", "wifi") or an executor alias
// (e.g. "flush-dns") resolves to the same authored steps as its canonical recipe. Kept lowercase.
export const WALK_ALIASES = Object.freeze({
  "printer": "printer-spooler-v1",
  "wifi": "wifi-no-internet-v1",
  "disk": "disk-low-space-v1",
  "password": "browser-password-loop-v1",
  "flush-dns": "flush-dns-cache",
  "restart-audio-service": "restart-audio"
});

/** Real steps for a recipe/executor/intent id, or [] when none are authored (caller shows the honest fallback). */
export function walkStepsFor(recipeId) {
  const id = String(recipeId || "").trim();
  if (!id) return [];
  if (WALK_STEPS[id]) return WALK_STEPS[id];
  const alias = WALK_ALIASES[id.toLowerCase()];
  return (alias && WALK_STEPS[alias]) ? WALK_STEPS[alias] : [];
}

/** True only when a recipe has genuinely authored steps (drives real-or-empty in the Walk-through tab). */
export function hasWalkSteps(recipeId) {
  return walkStepsFor(recipeId).length > 0;
}
