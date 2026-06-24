// RUN 35-1 — the ARIA Chat message log must scroll INTERNALLY; a long conversation must never grow the
// outer ARIA tab / portal. Structural proof of the CSS envelope + the JS auto-scroll/scroll-up-pause logic.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "src", "renderer", "sentinel.css"), "utf8");
const js = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
let n = 0; const t = () => { n++; };

// 1 — the panel is a bounded viewport envelope (so it can't grow with the conversation).
const panel = css.match(/\.aria-chat-panel\s*\{[^}]*\}/)[0];
assert.match(panel, /max-height:\s*calc\(100vh/, "chat panel is capped to a viewport-relative height");
assert.match(panel, /height:\s*calc\(100vh/, "chat panel has a fixed envelope height");
t();

// 2 — the log scrolls internally. min-height:0 is the critical bit that makes flex overflow actually fire.
const logRule = css.match(/\.aria-chat-log\s*\{[^}]*\}/)[0];
assert.match(logRule, /overflow-y:\s*auto/, "log scrolls internally");
assert.match(logRule, /min-height:\s*0/, "log has min-height:0 so the flex child can shrink + overflow");
t();

// 3 — head + composer + statusline are pinned (don't scroll with the messages).
for (const sel of ["aria-chat-head", "aria-chat-composer", "aria-chat-statusline"]) {
  const rule = css.match(new RegExp("\\." + sel + "\\s*\\{[^}]*\\}"))[0];
  assert.match(rule, /flex-shrink:\s*0/, `${sel} is pinned (flex-shrink:0)`);
}
t();

// 4 — auto-scroll respects the user reading history: stickToBottom pauses when they scroll up.
assert.match(js, /stickToBottom/, "scroll-up detection present");
assert.match(js, /scrollHeight\s*-\s*log\.scrollTop\s*-\s*log\.clientHeight\s*<\s*48/, "near-bottom threshold");
assert.match(js, /scrollEnd\s*=\s*\(force\s*=\s*false\)\s*=>\s*\{\s*if\s*\(force\s*\|\|\s*stickToBottom\)/, "scrollEnd honours stickToBottom unless forced");
assert.match(js, /scrollEnd\(who === "me"\)/, "the user's own message always jumps to bottom");
t();

assert.equal(n, 4, "4 scroll-containment groups");
console.log(`chat-scroll-containment test passed (${n} groups · viewport envelope · internal log scroll · pinned head/composer · auto-scroll with scroll-up pause).`);
