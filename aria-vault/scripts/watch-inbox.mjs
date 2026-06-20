#!/usr/bin/env node
// watch-inbox.mjs — runs in background. Watches 05_Inbox/_capture.md.
// When the file grows, invoke Claude Code's /capture slash command with the appended text.
// Mode B (set-and-forget): paste ideas into _capture.md from any tool; vault stays current.
//
// 2026-06-19 reliability fix: fs.watch() on Windows misses changes made by some editors
// and by cross-filesystem writers (WSL, sandbox mounts). Added a 2s polling fallback so the
// watcher fires reliably regardless of how the file is modified.

import { watch, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { VAULT, FOLDERS } from "./_vault.mjs";

const CAPTURE = join(VAULT, FOLDERS.inbox, "_capture.md");
let lastSize = (await stat(CAPTURE).catch(() => ({ size: 0 }))).size;
let busy = false;

console.log(`watch-inbox · watching ${CAPTURE} (from size ${lastSize})`);

async function checkOnce(source) {
  if (busy) return;
  busy = true;
  try {
    const cur = await stat(CAPTURE).catch(() => null);
    if (!cur) return;
    if (cur.size === lastSize) return;
    if (cur.size < lastSize) { lastSize = cur.size; return; } // truncate
    const text = await readFile(CAPTURE, "utf8");
    const fresh = text.slice(lastSize).trim();
    lastSize = cur.size;
    if (!fresh) return;
    console.log(`watch-inbox · [${source}] new text (${fresh.length} chars). Invoking /capture...`);
    spawn("claude", ["--print", `/capture ${fresh}`], { stdio: "inherit", shell: true, cwd: VAULT });
  } finally {
    busy = false;
  }
}

// Channel 1 — native fs.watch (fast when it fires)
(async () => {
  try {
    for await (const event of watch(CAPTURE)) {
      if (event.eventType === "change" || event.eventType === "rename") {
        await checkOnce("event");
      }
    }
  } catch (err) {
    console.error("watch-inbox · fs.watch failed (polling will continue):", err.message);
  }
})();

// Channel 2 — 2s polling fallback (reliability net for editors/cross-fs writers)
setInterval(() => { checkOnce("poll"); }, 2000);
