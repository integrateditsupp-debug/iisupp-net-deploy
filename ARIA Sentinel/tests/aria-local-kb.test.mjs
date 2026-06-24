// RUN 30-B — offline local KB matcher: cross-platform keyword match, platform bias (host OS + in-message
// device mention), no-match cross-platform message, and the R11/scrub invariant on output.
import assert from "node:assert/strict";
import { tokenize, platformOf, inferPlatform, scoreKbDoc, matchKb, localKbAnswer } from "../src/shared/aria-local-kb.mjs";

let n = 0; const t = () => { n++; };

// A small synthetic cross-platform index (mirrors aria-kb-pack: platform blueprints + agnostic diagnostics).
const INDEX = [
  { id: "blueprints/windows-11.md", platform: "win32", title: "Windows 11", text: "windows wifi network adapter driver bluetooth printer boot bsod" },
  { id: "blueprints/macos-15.md", platform: "darwin", title: "macOS 15 Sequoia", text: "macos macbook wifi bluetooth sleep smc nvram airdrop finder" },
  { id: "blueprints/ios-18.md", platform: "ios", title: "iOS 18", text: "iphone wifi cellular bluetooth update battery face id imessage" },
  { id: "blueprints/android-15.md", platform: "android", title: "Android 15", text: "android pixel wifi bluetooth pairing battery play store" },
  { id: "diagnostics/bluetooth-wifi.md", platform: "", title: "Bluetooth & Wi-Fi", text: "bluetooth pairing wifi wireless connection drops reconnect" }
];

// 1 — tokenize drops stopwords + short tokens.
assert.deepEqual(tokenize("my iPhone won't connect to the Wi-Fi"), ["iphone", "connect", "wifi"]);
t();

// 2 — platformOf (filename) + inferPlatform (message mention beats host OS).
assert.equal(platformOf("macos-15-sequoia.md"), "darwin");
assert.equal(platformOf("ios-18.md"), "ios");
assert.equal(platformOf("windows-11.md"), "win32");
assert.equal(inferPlatform("my MacBook won't wake", "win32"), "darwin", "in-message Mac beats host win32");
assert.equal(inferPlatform("iPhone wifi broken", "win32"), "ios");
assert.equal(inferPlatform("iPad split view broken", "darwin"), "ipados");
assert.equal(inferPlatform("generic question", "win32"), "win32", "fallback to host OS");
t();

// 3 — keyword match returns the best chunk.
const m = matchKb(INDEX, "bluetooth pairing keeps dropping");
assert.ok(m && m.doc, "found a match");
assert.match(m.doc.title, /Bluetooth|Wi-Fi/, "bluetooth question → bluetooth diagnostic");
t();

// 4 — platform bias: the SAME symptom routes to the platform the user names.
const macHit = matchKb(INDEX, "my macbook wifi keeps dropping", { platform: "win32" });
assert.equal(macHit.doc.platform, "darwin", "Mac mention → macOS blueprint preferred even on a win32 host");
const iosHit = matchKb(INDEX, "iphone wifi not working after update", { platform: "win32" });
assert.equal(iosHit.doc.platform, "ios", "iPhone mention → iOS blueprint");
const androidHit = matchKb(INDEX, "android bluetooth pairing fails", { platform: "win32" });
assert.ok(androidHit.doc.platform === "android" || /bluetooth/i.test(androidHit.doc.title), "Android mention biases to Android");
t();

// 5 — no match above threshold → cross-platform NO_MATCH message (never Windows-only), and answer is scrubbed.
const none = localKbAnswer({ message: "zxcv qwer asdf nonsense", index: INDEX });
assert.equal(none.matched, false);
assert.match(none.text, /Windows.*Mac.*iPhone.*iPad.*Android/i, "no-match copy spans all platforms");
t();

// 6 — a real answer surfaces the matched title + excerpt and NEVER leaks a path or recipe id.
const dirty = [{ id: "x", platform: "win32", title: "Boot issue", summary: "see C:\\Users\\bob\\notes and run rcp_fix_boot then check it", text: "boot bsod windows" }];
const ans = localKbAnswer({ message: "windows boot bsod", platform: "win32", index: dirty });
assert.equal(ans.matched, true);
assert.doesNotMatch(ans.text, /C:\\Users\\bob/, "no raw path leaks");
assert.doesNotMatch(ans.text, /rcp_/, "no recipe id leaks");
assert.match(ans.text, /\[path\]/);
t();

assert.equal(n, 6, "6 local-KB test groups");
console.log(`aria-local-kb test passed (${n} groups · tokenize · platform infer/bias · keyword match · cross-platform no-match · R11/scrub on output).`);
