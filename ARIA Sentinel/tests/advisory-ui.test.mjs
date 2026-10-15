// 2026-10-14 — "advise three times, then act": the SURFACES of the rule, fed the REAL notices.
//
// The fixtures are not hand-written: the fault lab (tests/lib/fault-lab.mjs) boots the real main.mjs on a simulated
// Windows machine, injects two faults (a stale DNS cache → the auto-fix track; a stopped print spooler → needs admin →
// the IT-contact track) and records exactly what main pushed to the globe (sentinel:advisory) and put in getState().
// Those payloads then drive:
//   A. the wiring — IPC channels ↔ preload ↔ renderer (additive: nothing renamed or removed)
//   B. the pure builders — Home "What I need from you" rows, the content-blind bridge slice (/state)
//   C. the REAL renderer pages (Playwright/Chromium, opt-in like every renderer suite): the globe card "Notice 1 of 3"
//      with Fix now · Not now · Never for this, the Home rows, and Settings → Autonomy's interval + rule sentence.
// 🔒 the excluded folder is referenced only through path-guard.mjs (its name never appears in this file).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bootLab } from "./lib/fault-lab.mjs";
import { available, withPage, dashboardWithDataState, firstLaunchState, visible, text } from "./lib/renderer-harness.mjs";
import { needRowsHtml, advisoryRowsHtml, homeListsHtml } from "../src/renderer/tabs/home.mjs";
import { scrubPublicState, advisoryPublicSlice } from "../src/shared/bridge-auth.mjs";
import { ruleSentence, ADVISORY_CHOICES } from "../src/shared/advisory-escalation.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let groups = 0; const t = () => { groups++; };

// ── The real notices, from the real main ─────────────────────────────────────────────────────────────────────
const lab = await bootLab({ mode: "autonomous", vetted: { "dns-fail-v1": 12, "svc-spooler-stopped-v1": 12 } });
lab.inject("stale-dns");
lab.inject("spooler-stuck");
await lab.detect();
const views = lab.advisories();
const pushes = lab.overlay.sent.filter((m) => m.channel === "sentinel:advisory").map((m) => m.payload);
const appPushes = lab.appWin.sent.filter((m) => m.channel === "sentinel:advisory").map((m) => m.payload);
const fullState = lab.state();
lab.booted.shutdown();
const dns = views.find((v) => v.recipeId === "dns-fail-v1");
const spooler = views.find((v) => v.recipeId === "svc-spooler-stopped-v1");
assert.ok(dns && spooler, `the lab produced both notices (got ${views.map((v) => v.recipeId).join(", ")})`);
assert.equal(dns.track, "auto-fix"); assert.equal(spooler.track, "tech-contact"); assert.equal(spooler.kind, "needs-admin");
assert.equal(pushes.length, 2, "one globe card per notice");
assert.equal(appPushes.length, 2, "the app window hears each notice too (ARIA chat line)");
assert.deepEqual(pushes.map((p) => p.id).sort(), views.map((v) => v.id).sort(), "the card pushed IS the notice in state");
for (const p of pushes) {
  assert.deepEqual(Object.keys(p).sort(), ["advisory", "choices", "color", "copy", "frozen", "id", "kind", "minutesUntilAction", "nextAt", "of", "recipeId", "snoozedUntil", "status", "title", "track"].sort());
  assert.equal(p.advisory, 1); assert.equal(p.of, 3); assert.deepEqual(p.choices, [...ADVISORY_CHOICES]);
}
t();

// ── A. wiring (source level; additive) ──────────────────────────────────────────────────────────────────────
{
  const main = rd("src", "main", "main.mjs");
  const preload = rd("src", "main", "preload.cjs");
  for (const ch of ["sentinel:advisory-ack", "sentinel:get-advisory-prefs", "sentinel:set-advisory-prefs"]) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\("${ch}"`), `main handles ${ch}`);
    assert.match(preload, new RegExp(`ipcRenderer\\.invoke\\("${ch}"`), `preload exposes ${ch}`);
  }
  assert.match(preload, /advisoryAck: \(id, choice\) => ipcRenderer\.invoke\("sentinel:advisory-ack", \{ id, choice \}\)/);
  assert.match(preload, /onAdvisory: \(cb\) => \{[^}]*ipcRenderer\.on\("sentinel:advisory"/);
  assert.match(main, /webContents\.send\("sentinel:advisory", view\)/, "main pushes the notice to the globe + the app window");
  assert.match(main, /advisories: advisoryMachine\.forState\(/, "getState().advisories");
  // Rule 15 — the channels that existed before are still there, unchanged.
  for (const ch of ["sentinel:approve-fix", "sentinel:deny-fix", "sentinel:list-approvals", "sentinel:supervised-fix", "sentinel:get-state"]) assert.match(main, new RegExp(`ipcMain\\.handle\\("${ch}"`), `${ch} kept`);
  const overlayHtml = rd("src", "renderer", "overlay.html");
  for (const id of ["overlayFix", "overlayDismiss", "overlayChip", "overlayTitle", "overlayBody"]) assert.match(overlayHtml, new RegExp(`id="${id}"`), `#${id} kept`);
  for (const c of ADVISORY_CHOICES) assert.match(overlayHtml, new RegExp(`data-advisory-choice="${c}"`), `the card offers ${c}`);
  const overlayJs = rd("src", "renderer", "overlay.js");
  assert.match(overlayJs, /onAdvisory: \(\) => \{\}/, "the overlay's no-bridge fallback knows the new listener");
  assert.match(overlayJs, /advisoryAck: async \(\) => \(\{ ok: false, error: "bridge_unavailable" \}\)/, "…and never pretends a choice was recorded");
  const noticeBlock = overlayJs.slice(overlayJs.indexOf("ADVISE-FIRST NOTICES"), overlayJs.indexOf("ARIA COMPANION —"));
  assert.ok(noticeBlock.length > 500 && /\.textContent = /.test(noticeBlock), "the notice block is found and writes text");
  assert.doesNotMatch(noticeBlock, /innerHTML|insertAdjacentHTML|outerHTML/, "notice copy is never written as HTML");
  const indexHtml = rd("src", "renderer", "index.html");
  assert.match(indexHtml, /id="advisoryInterval" type="number" min="1" max="60"/, "interval field clamps 1–60");
  assert.match(indexHtml, /id="advisorySnooze" type="number" min="1" max="72"/);
  assert.match(indexHtml, /id="advisoryRuleSentence"/);
  for (const id of ["autonomyPanel", "saveAutonomyPrefs", "autonomyCards", "liveFixesToggle"]) assert.match(indexHtml, new RegExp(`id="${id}"`), `#${id} kept`);
  const renderer = rd("src", "renderer", "renderer.js");
  assert.match(renderer, /import \{ ruleSentence[^}]*\} from "\.\.\/shared\/advisory-escalation\.mjs"/, "the sentence comes from the module the code runs");
  assert.match(renderer, /sentinel\.advisoryAck\?\.\(b\.dataset\.advisoryAck, b\.dataset\.choice\)/);
  assert.match(renderer, /HomeTab\.advisoryRowsHtml\(Array\.isArray\(next\.advisories\)/, "Home gets the notices from getState().advisories");
  assert.match(renderer, /sentinel\.setAdvisoryPrefs\?\.\(\{ intervalMinutes:/);
  const pkg = JSON.parse(rd("package.json"));
  assert.ok(pkg.build.files.includes("src/shared/advisory-escalation.mjs"), "the module ships in the customer build");
}
t();

// ── B1. Home "What I need from you" — notices first, each with the choices that still apply ───────────────────
{
  const html = needRowsHtml({ advisories: views });
  assert.equal((html.match(/class="home-row need-advisory"/g) || []).length, 2);
  assert.equal((html.match(/data-advisory-ack=/g) || []).length, 6, "three choices on each open notice");
  assert.match(html, new RegExp(`data-advisory-ack="${dns.id}" data-choice="fix-now">Fix now<`));
  assert.match(html, new RegExp(`data-advisory-ack="${dns.id}" data-choice="not-now">Not now \\(4 h\\)<`));
  assert.match(html, new RegExp(`data-advisory-ack="${dns.id}" data-choice="never">Never for this<`));
  assert.match(html, /I found a problem: DNS lookup failed\./);
  assert.match(html, /If you don&#39;t choose, I&#39;ll fix it in about \d+ minutes|If you don't choose, I'll fix it in about \d+ minutes/);
  assert.match(html, /tell your IT contact in about \d+ minutes/, "the needs-admin notice says the IT contact will be told");
  assert.match(html, /home-time">1 of 3</);
  // existing rows stay exactly as they were; nothing to say → the same honest sentence
  assert.equal(needRowsHtml({}), needRowsHtml({ advisories: [] }));
  assert.match(needRowsHtml({}), /Nothing needs you right now\./);
  const withApproval = needRowsHtml({ advisories: [dns], approvals: { pending: [{ id: "a1", title: "Renew", color: "yellow" }] } });
  assert.ok(withApproval.indexOf("need-advisory") < withApproval.indexOf("need-approval"), "a notice (time-bound) is listed before approvals");
  assert.match(homeListsHtml({ advisories: [dns] }), /id="homeNeed"[^]*need-advisory/);
  // a running fix has no choices; a snoozed one offers Fix now + Never only
  assert.doesNotMatch(advisoryRowsHtml([{ ...dns, status: "fixing", copy: { ...dns.copy, choices: [] } }]), /data-advisory-ack/);
  // every string is escaped and redacted
  const evil = { ...dns, copy: { ...dns.copy, found: `I found a problem: <img src=x onerror=alert(1)> C:\\Users\\Sam\\${PRIVATE_FOLDER_NAME}\\a.jpg` } };
  const out = advisoryRowsHtml([evil]);
  assert.doesNotMatch(out, /<img/); assert.ok(!out.toLowerCase().includes(PRIVATE_FOLDER_NAME.toLowerCase()), "the excluded folder never surfaces");
}
t();

// ── B2. the bridge's public /state: the escalations, content-blind ─────────────────────────────────────────────
{
  const pub = scrubPublicState(fullState);
  assert.equal(pub.advisory.active.length, 2);
  for (const a of pub.advisory.active) assert.deepEqual(Object.keys(a).sort(), ["advisory", "frozen", "id", "kind", "nextAt", "of", "recipeId", "status", "track"]);
  const text = JSON.stringify(pub.advisory);
  assert.ok(!text.includes("DNS lookup failed") && !text.includes("I found a problem") && !text.includes("example.com"), "no titles, no notice copy, no contacts");
  assert.ok(pub.advisory.auditTags.advisory >= 2, "the ADVISORY audit rows are counted (tags only)");
  assert.deepEqual(Object.keys(pub.counts).sort(), ["approvalsPending", "auditEvents", "detections", "incidents", "recipes"], "the existing counts are unchanged");
  // fails closed: anything that is not an id / a status word / a small integer / an ISO time is dropped to null
  const slice = advisoryPublicSlice({
    advisories: [{ id: "adv-1-x", recipeId: "dns-fail-v1", track: "auto-fix", kind: "green", status: "advising", advisory: 1, of: 3, nextAt: "2026-10-14T10:03:00.000Z", title: "secret title", copy: { found: "secret" } },
      { id: "<script>", recipeId: `C:\\${PRIVATE_FOLDER_NAME}`, track: "Auto Fix!", status: 7, advisory: -1, of: 1e6, nextAt: "soon" }],
    advisoryOutcomes: [{ id: "adv-2-y", recipeId: "svc-spooler-stopped-v1", track: "tech-contact", status: "escalated", outcome: "escalated-unanswered", advisories: 3, of: 3, choice: null, closedAt: "2026-10-14T10:12:00.000Z" },
      { id: "adv-3-z", recipeId: "dns-fail-v1", status: "fix-failed", outcome: "exit 1 at C:\\Users\\Sam" }],
    transparencyLog: [{ tag: "ADVISORY", text: "x" }, { tag: "AUTO-FIX", text: "y" }, { tag: "ESCALATE", text: "z" }, { tag: "RUN", text: "w" }]
  });
  assert.equal(JSON.stringify(slice).includes("secret"), false);
  assert.deepEqual(slice.active[1], { id: null, recipeId: null, track: null, kind: null, status: null, advisory: null, of: null, nextAt: null, frozen: false });
  assert.equal(slice.outcomes[1].outcome, null, "free text never passes as an outcome word");
  assert.deepEqual(slice.auditTags, { advisory: 1, autoFix: 1, escalate: 1 });
  assert.deepEqual(advisoryPublicSlice(null), { active: [], outcomes: [], auditTags: { advisory: 0, autoFix: 0, escalate: 0 } });
}
t();

// ── C. the REAL renderer pages (opt-in: Playwright + Chromium) ─────────────────────────────────────────────────
const env = available();
let rendererLine = "";
if (!env.ok) {
  rendererLine = ` · renderer pages SKIPPED — ${env.reason}`;
} else {
  const dnsPush = pushes.find((p) => p.recipeId === "dns-fail-v1");
  const ACK = `(id, choice) => { calls.push({ fn: "advisoryAck", args: [id, choice] }); return Promise.resolve(choice === "not-now" ? { ok: true, choice, advisory: { snoozedUntil: new Date(Date.now() + 4 * 3600000).toISOString() }, fix: null } : choice === "never" ? { ok: true, choice, advisory: {}, fix: null } : { ok: true, choice, advisory: {}, fix: { ok: true, verdict: "approve", countdown: true, countdownId: "cd-1", seconds: 10, policy: { dryRun: false }, copy: "" } }); }`;

  // C1 — the globe card: Notice 1 of 3 · what was found · what ARIA will do · when · three choices.
  {
    const r = await withPage({ state: firstLaunchState({ mode: "autonomous", setupNeeded: false, firstRunComplete: true }), page: "/src/renderer/overlay.html", viewport: { width: 360, height: 500 }, handlers: { onAdvisory: `on("advisory")`, advisoryAck: ACK } }, async (page) => {
      await page.evaluate((v) => window.__emit("advisory", v), dnsPush);
      await page.waitForTimeout(80);
      const out = {
        card: await visible(page, "#overlayCard"), chip: await text(page, "#overlayChip"), title: await text(page, "#overlayTitle"), body: await text(page, "#overlayBody"),
        fix: await visible(page, "#advisoryFixNow"), notNow: await visible(page, "#advisoryNotNow"), never: await visible(page, "#advisoryNever"),
        labels: await page.evaluate(() => [...document.querySelectorAll("[data-advisory-choice]")].map((b) => b.textContent)),
        detectorButtons: await visible(page, "#overlayActions"),
        scroll: await page.evaluate(() => { const c = document.querySelector("#overlayCard"); return c.scrollHeight - c.clientHeight; })
      };
      // the detection for the SAME problem arrives right after the notice: the notice stays on the card
      await page.evaluate(() => window.__emit("detection", { id: "d1", recipeId: "dns-fail-v1", title: "DNS lookup failed", chip: "NETWORK - DNS", summary: "x", risk: "green" }));
      await page.waitForTimeout(40);
      out.chipAfterDetection = await text(page, "#overlayChip");
      await page.click("#advisoryNotNow");
      await page.waitForTimeout(80);
      out.calls = await page.evaluate(() => window.__calls.filter((c) => c.fn === "advisoryAck"));
      out.status = await text(page, "#overlayAdvisoryStatus");
      out.choicesAfter = await page.evaluate(() => [...document.querySelectorAll("[data-advisory-choice]")].filter((b) => !b.hidden).length);
      return out;
    });
    assert.deepEqual(r.errors, [], `overlay page errors: ${r.errors.join(" | ")}`);
    const o = r.result;
    assert.equal(o.card, "visible"); assert.equal(o.chip, "Notice 1 of 3".toUpperCase()); assert.equal(o.title, dnsPush.copy.found);
    assert.ok(o.body.includes(dnsPush.copy.willDo) && o.body.includes(dnsPush.copy.when), "what ARIA will do + when, in main's words");
    assert.match(o.body, /If you don't choose, I'll fix it in about \d+ minutes/);
    assert.equal(o.fix, "visible"); assert.equal(o.notNow, "visible"); assert.equal(o.never, "visible");
    assert.deepEqual(o.labels, ["Fix now", "Not now (4 h)", "Never for this"]);
    assert.equal(o.detectorButtons, "hidden", "Open fix / Dismiss give way to the three choices");
    assert.ok(o.scroll <= 1, `the notice fits the card without a scrollbar (overflow ${o.scroll}px)`);
    assert.equal(o.chipAfterDetection, "NOTICE 1 OF 3", "the plain detector card never covers the notice");
    assert.deepEqual(o.calls, [{ fn: "advisoryAck", args: [dnsPush.id, "not-now"] }]);
    assert.match(o.status, /^OK — not now\. I'll tell you again after .+; nothing runs before then\.$/);
    assert.equal(o.choicesAfter, 0, "a choice ends the notice on the card");
  }
  t();

  // C2 — Home: the notices in "What I need from you", answered from the row.
  {
    const r = await withPage({ state: dashboardWithDataState({ mode: "autonomous", advisories: views }), handlers: { onAdvisory: `on("advisory")`, advisoryAck: ACK } }, async (page) => {
      const out = { rows: await page.evaluate(() => document.querySelectorAll("#homeNeed .need-advisory").length), buttons: await page.evaluate(() => document.querySelectorAll("#homeNeed [data-advisory-ack]").length) };
      out.firstText = await text(page, "#homeNeed .need-advisory");
      await page.click(`#homeNeed [data-advisory-ack="${dns.id}"][data-choice="fix-now"]`);
      await page.waitForTimeout(120);
      out.calls = await page.evaluate(() => window.__calls.filter((c) => c.fn === "advisoryAck"));
      out.toast = await text(page, "#toastStack");
      // the same push main sends the app window → one plain line in ARIA chat
      await page.evaluate((v) => window.__emit("advisory", v), appPushes.find((p) => p.recipeId === "dns-fail-v1"));
      await page.waitForTimeout(40);
      out.chat = await text(page, "#ariaChatLog");
      return out;
    });
    assert.deepEqual(r.errors, [], `home page errors: ${r.errors.join(" | ")}`);
    assert.ok(r.result.chat.includes(`Notice 1 of 3: ${dns.copy.found} ${dns.copy.willDo}`), `the notice lands in ARIA chat in plain words (got: ${r.result.chat.slice(0, 200)})`);
    assert.match(r.result.chat, /Fix now · Not now \(4 h\) · Never for this/);
    assert.equal(r.result.rows, 2); assert.equal(r.result.buttons, 6);
    assert.match(r.result.firstText, /Notice 1 of 3/);
    assert.deepEqual(r.result.calls, [{ fn: "advisoryAck", args: [dns.id, "fix-now"] }]);
    assert.match(r.result.toast, /Fix now/);
  }
  t();

  // C3 — Settings → Autonomy: the interval field + the rule sentence generated from the same constants.
  {
    const PREFS = `async () => ({ ok: true, prefs: { intervalMinutes: 5, snoozeHours: 4 }, limits: { intervalMinutes: [1, 60], snoozeHours: [1, 72] }, rule: "", never: ["svc-spooler-stopped-v1"] })`;
    const SET = `async (p) => { calls.push({ fn: "setAdvisoryPrefs", args: [p] }); return { ok: true, prefs: { intervalMinutes: Math.min(60, Math.max(1, Math.round(Number(p.intervalMinutes) || 3))), snoozeHours: Number(p.snoozeHours) || 4 }, never: ["svc-spooler-stopped-v1"] }; }`;
    const r = await withPage({ state: dashboardWithDataState({ mode: "autonomous" }), handlers: { getAdvisoryPrefs: PREFS, setAdvisoryPrefs: SET } }, async (page) => {
      await page.click('.nav-item[data-tab="settings"]');
      await page.waitForTimeout(200);
      const out = { sentence: await text(page, "#advisoryRuleSentence"), value: await page.inputValue("#advisoryInterval"), never: await text(page, "#advisoryNeverList") };
      await page.fill("#advisoryInterval", "7");
      out.typed = await text(page, "#advisoryRuleSentence");
      await page.click("#saveAdvisoryPrefs");
      await page.waitForTimeout(120);
      out.calls = await page.evaluate(() => window.__calls.filter((c) => c.fn === "setAdvisoryPrefs"));
      out.status = await text(page, "#advisoryPrefsStatus");
      return out;
    });
    assert.deepEqual(r.errors, [], `settings page errors: ${r.errors.join(" | ")}`);
    assert.equal(r.result.sentence, ruleSentence({ advisoryIntervalMinutes: 5 }));
    assert.equal(r.result.value, "5");
    assert.equal(r.result.typed, ruleSentence({ advisoryIntervalMinutes: 7 }), "the sentence follows the number as it is typed");
    assert.deepEqual(r.result.calls, [{ fn: "setAdvisoryPrefs", args: [{ intervalMinutes: 7, snoozeHours: 4 }] }]);
    assert.match(r.result.status, /Saved · a notice every 7 min · Not now waits 4 h/);
    assert.match(r.result.never, /Allow again/);
  }
  t();
  rendererLine = " · renderer pages: globe card / Home rows / Settings → Autonomy driven by main's real notices";
}

console.log(`advisory-ui test passed (${groups} groups · main's notices → globe card · Home rows · chat · bridge slice (content-blind, fails closed) · additive wiring${rendererLine}).`);
