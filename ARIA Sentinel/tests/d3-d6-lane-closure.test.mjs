// Phase F — closure of the D3–D6 live-sweep lane (senior-director-state/loop-engineer/claude-next-prompt.md)
// verified against the CURRENT line. (D1 = kb-phrase-routing.test.mjs · D2 = chat-activity-recording.test.mjs.)
//   D3 — "Check for updates" is never a dead end: a failed check states the real version + manual path.
//   D4 — ARIA→Health agrees with the content boundary: external AI disabled ⇒ Anthropic tier shows OFF.
//   D5 — the left nav rail is sticky (always reachable on long pages), banner-aware.
//   D6 — the System disk row shows real usage (read-only Win32_LogicalDisk), honest fallback until collected.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildSystemContext } from "../src/main/system-context.mjs";

const rendererJs = fs.readFileSync(path.resolve("src/renderer/renderer.js"), "utf8");
const mainJs = fs.readFileSync(path.resolve("src/main/main.mjs"), "utf8");
const css = fs.readFileSync(path.resolve("src/renderer/sentinel.css"), "utf8");

// ── D3 — honest update-check copy ──
assert.doesNotMatch(rendererJs, /Update check unavailable\./, "D3: the dead-end copy is gone");
assert.match(rendererJs, /Couldn't reach the update server — you're on \$\{r\?\.current/, "D3: failure copy names the real version");
assert.match(rendererJs, /Manual updates still work\./, "D3: failure copy keeps a real path forward");
assert.match(mainJs, /return \{ ok: false, current: SENTINEL_VERSION/, "D3: main returns the current version even on failure");

// ── D4 — Health honors the content boundary ──
assert.match(rendererJs, /externalAiOff = state && state\.externalAiCalls === false/, "D4: Health reads the runtime boundary flag");
assert.match(rendererJs, /externalAiOff && \/anthropic\/i\.test\(tr\.name\)/, "D4: the Anthropic tier is the one overridden");
assert.match(rendererJs, /off on this device \(content boundary\)/, "D4: Anthropic renders as off, not a healthy fallback");

// ── D5 — sticky nav rail ──
const railBlock = css.slice(css.indexOf(".settings-rail {"), css.indexOf(".settings-brand"));
assert.match(railBlock, /position:\s*sticky/, "D5: rail is sticky");
assert.match(railBlock, /max-height:\s*100vh/, "D5: rail is viewport-bound");
assert.match(railBlock, /overflow-y:\s*auto/, "D5: a too-tall rail scrolls internally, never disappears");
assert.match(css, /body\.has-security-banner \.settings-rail \{\s*\n?\s*top: 58px/, "D5: sticky rail clears the fixed security banner");

// ── D6 — real disk usage, read-only collection, honest fallback ──
assert.match(mainJs, /Win32_LogicalDisk -Filter \\"DeviceID='C:'\\"/, "D6: system drive collected via read-only Win32_LogicalDisk");
const hwCmd = mainJs.slice(mainJs.indexOf('"hardware":'), mainJs.indexOf("function runPowerShell"));
assert.doesNotMatch(hwCmd, /Set-|New-Item|Remove-|reg add|reg delete/, "D6: the hardware collector stays read-only");
// buildSystemContext carries sysDrive (pure), and drops to null when absent (real-or-empty).
const ctx = buildSystemContext({ sysDrive: { size: 1000000000000, free: 250000000000 } });
assert.equal(ctx.sysDrive.free, 250000000000, "D6: sysDrive rides the context shape");
assert.equal(buildSystemContext({}).sysDrive, null, "D6: absent collection -> null, never invented");
assert.match(rendererJs, /diskPct != null \? `\$\{diskPct\}% used · \$\{Math\.round\(driveFree \/ 1073741824\)\} GB free`/, "D6: disk row shows % used + GB free");
assert.match(rendererJs, /usage pending next inventory refresh/, "D6: honest fallback copy until the next refresh");
assert.match(rendererJs, /ok: diskPct != null \? diskPct < 90 : true/, "D6: a nearly-full disk flags CHECK like RAM does");

console.log("D3–D6 lane-closure test passed (honest update-check copy · Health honors content boundary · sticky banner-aware nav rail · real read-only disk usage with honest fallback).");
