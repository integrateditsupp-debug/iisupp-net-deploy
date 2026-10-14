// sentinel-downloads-page.test.mjs — 2026-10-14. The /downloads/ additions stay honest and stay in step with the app.
//
// /downloads/ gained three sections: a scripted simulation of ARIA Sentinel's Autonomous rule (assets/sentinel-sim.js),
// a savings estimate from the visitor's inputs, and a "Get ARIA Sentinel" block driven by downloads/sentinel-release.json.
// Each one quotes the app, so each one is pinned to the app here:
//   - the simulation banner says it is a simulation, verbatim;
//   - the Autonomous legend IS ruleSentence(); every notice line IS advisoryCopy() for the same record and clock;
//   - recipe titles / action labels / success lines ARE recipes.mjs; the per-fix minutes IS roi.mjs;
//   - the plan prices in the page's inline JSON ARE pricing-tiers.mjs (and what /plans shows);
//   - the release file keeps its contract; the simulation script has no network code at all;
//   - no internal names, and the existing sell-page content (states, forms, tier keys) is untouched.
// Plain node:assert, no dependencies.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ruleSentence, openRecord, tickState, advisoryCopy, emptyAdvisoryState, ADVISORY_COUNTDOWN_SECONDS, ADVISORY_INTERVAL_DEFAULT_MIN } from "../ARIA Sentinel/src/shared/advisory-escalation.mjs";
import { RECIPES } from "../ARIA Sentinel/src/shared/recipes.mjs";
import { DEFAULT_MINUTES_PER_FIX } from "../ARIA Sentinel/src/shared/roi.mjs";
import { TIERS, CLIENT_PLANS } from "../ARIA Sentinel/src/shared/pricing-tiers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const page = read("downloads/index.html");
const simSrc = read("assets/sentinel-sim.js");
const sim = createRequire(import.meta.url)(path.join(root, "assets/sentinel-sim.js"));
const plansPage = read("plans/index.html");
const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&mdash;/g, "—").replace(/&middot;/g, "·").replace(/&rarr;/g, "→")
  .replace(/&ldquo;|&rdquo;/g, "\"").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();
const byId = (id) => {
  const m = page.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`, "i"));
  assert.ok(m, `#${id} exists`);
  return m[2];
};
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// 1 — the banner, verbatim, in the page.
const BANNER = "Simulation — scripted on this page. Nothing runs on your computer.";
ok(page.includes(BANNER), "the simulation banner is on the page verbatim");
ok(decode(byId("sim-banner")) === BANNER, "#sim-banner holds exactly the banner sentence");

// 2 — the three scenarios: titles on the page (static, readable without JS) and in the script, in the same order.
const TITLES = ["Wi-Fi connected, no internet / stale DNS", "Printer stuck / queue frozen", "Critical system files / BitLocker recovery"];
for (const t of TITLES) ok(page.includes(t), `scenario title on the page: ${t}`);
assert.deepEqual(sim.SCENARIOS.map((s) => s.title), TITLES, "sentinel-sim.js plays the same three scenarios in the same order"); checks++;
const tabKeys = [...page.matchAll(/data-sim-scenario="([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(tabKeys, sim.SCENARIOS.map((s) => s.key), "one tab per scenario, same order as the script"); checks++;
ok(page.includes(sim.SPEED_NOTE) && sim.SPEED_NOTE === "sped up: 3 minutes → 3 seconds", "the visible speed note says 3 minutes → 3 seconds");
ok(sim.INTERVAL_MINUTES === ADVISORY_INTERVAL_DEFAULT_MIN && sim.COUNTDOWN_SECONDS === ADVISORY_COUNTDOWN_SECONDS, "the sim's 3-minute interval and 10-second countdown are the app's constants");
ok(sim.INTERVAL_MS === 3000, "3 minutes are shown as 3 seconds");

// 3 — the mode legend: Autonomous is ruleSentence() word for word; Manual/Confirmed say what the matrix says.
ok(decode(byId("sim-rule-autonomous")) === ruleSentence(), "the Autonomous legend equals ruleSentence()");
ok(page.includes(ruleSentence()), "ruleSentence() appears verbatim in the HTML source");
ok(/Previews only/.test(page) && /Asks once/.test(page) && /The 3-notice rule/.test(page), "Manual = previews only · Confirmed = asks once · Autonomous = the 3-notice rule");
ok(/Personal is Manual only/.test(page) && JSON.stringify(TIERS.personal.features.modes) === '["manual"]', "the legend's 'Personal is Manual only' matches pricing-tiers.mjs");

// 4 — every notice line is the app's own copy for the same record and the same clock.
const recipe = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const T0 = Date.parse("2026-10-14T12:00:00Z");
for (const sc of sim.SCENARIOS) {
  const r = recipe[sc.recipe.id];
  ok(r, `${sc.key}: recipe ${sc.recipe.id} exists in recipes.mjs`);
  ok(sc.recipe.title === r.title, `${sc.key}: recipe title "${sc.recipe.title}" == recipes.mjs "${r.title}"`);
  if (sc.recipe.actions) assert.deepEqual(sc.recipe.actions, r.actions.map((a) => a.label), `${sc.key}: action labels == recipes.mjs`), checks++;
  if (sc.recipe.success) ok(sc.recipe.success === r.success, `${sc.key}: success line == recipes.mjs`);
  if (sc.recipe.also) ok(recipe[sc.recipe.also.id] && recipe[sc.recipe.also.id].title === sc.recipe.also.title, `${sc.key}: ${sc.recipe.also.id} title == recipes.mjs`);
  const colour = r.risk === "red" ? "red" : "green";
  ok(sc.recipe.colour === colour, `${sc.key}: colour ${sc.recipe.colour}`);
  let st = emptyAdvisoryState();
  const opened = openRecord(st, { detectionId: `t-${sc.key}`, recipeId: r.id, title: r.title, summary: r.summary, color: colour, track: sc.track, kind: sc.kind }, T0, {});
  st = opened.state;
  for (let n = 1; n <= 3; n++) {
    const now = T0 + (n - 1) * ADVISORY_INTERVAL_DEFAULT_MIN * 60000;
    if (n > 1) st = tickState(st, now, {}, {}).state;
    const copy = advisoryCopy(st.records[0], {}, now);
    const mine = sc.notices[n - 1];
    ok(mine.line === copy.line, `${sc.key} notice ${n}: "${mine.line}"`);
    ok(mine.found === copy.found, `${sc.key} notice ${n}: found == advisoryCopy (${copy.found})`);
    ok(mine.willDo === copy.willDo, `${sc.key} notice ${n}: willDo == advisoryCopy (${copy.willDo})`);
    ok(mine.when === copy.when, `${sc.key} notice ${n}: when == advisoryCopy (${copy.when})`);
    assert.deepEqual(sc.choices, copy.choices.map((c) => c.label), `${sc.key} notice ${n}: the three choices == advisoryCopy`); checks++;
  }
  // after the third interval: auto-fix track fixes, every other track goes to a person — never the other way round
  const last = tickState(st, T0 + 3 * ADVISORY_INTERVAL_DEFAULT_MIN * 60000, {}, {});
  const effect = last.effects.map((e) => e.type)[0];
  ok(effect === (sc.track === "auto-fix" ? "auto-fix" : "escalate"), `${sc.key}: after 3 unanswered notices the app's next step is ${effect}`);
}
// the outcomes the matrix records for these faults (docs/MODE-BEHAVIOUR-MATRIX.md, autonomous rows)
const matrix = read("ARIA Sentinel/docs/MODE-BEHAVIOUR-MATRIX.md");
const rowOf = (id) => matrix.split("\n").find((l) => l.includes(`(\`${id}\`)`)) || "";
ok(/3 notices → fixed on its own after the 10-s countdown/.test(rowOf("stale-dns")) && /\| green \| no \|/.test(rowOf("stale-dns")), "matrix: stale-dns is green, no admin, fixed on its own after 3 notices + countdown");
ok(/3 notices → IT contact told, never run/.test(rowOf("spooler-stuck")) && /\| yes \|/.test(rowOf("spooler-stuck")), "matrix: the stuck spooler needs admin and goes to the IT contact, never run");
for (const id of ["system-files-corrupt", "bitlocker-recovery"]) ok(/\| red \|/.test(rowOf(id)) && /3 notices → IT contact told, never run/.test(rowOf(id)), `matrix: ${id} is red and never run`);
ok(/Needs administrator rights, so ARIA does not run this on its own: your IT contact is notified; Fix now runs it with you present \(Windows asks for permission\)\./.test(simSrc), "scenario 2 says why it is not run on its own");
ok(simSrc.includes("Never automatic. ARIA explains, collects evidence content-blind, and hands it to a person."), "scenario 3 says red is never automatic");
ok(/What changed: DNS cache \\u2014 nothing else\./.test(simSrc), "scenario 1 ends with what changed");

// 5 — the simulation runs nothing and calls nothing.
for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /\bimport\s*\(/, /\beval\s*\(/, /new\s+Function/]) ok(!bad.test(simSrc), `sentinel-sim.js has no ${bad}`);
ok(/<script src="\/assets\/sentinel-sim\.js\?v=[\w.-]+" defer><\/script>/.test(page) && fs.existsSync(path.join(root, "assets/sentinel-sim.js")), "the page loads assets/sentinel-sim.js (deferred)");
ok(/<link rel="stylesheet" href="\/assets\/sentinel-sim\.css\?v=[\w.-]+">/.test(page) && fs.existsSync(path.join(root, "assets/sentinel-sim.css")), "the page loads assets/sentinel-sim.css");

// 6 — the savings estimate: defaults on the page, the per-fix minutes is the app's ROI constant, every figure labelled.
const inputValue = (id) => { const m = page.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`)); assert.ok(m, `#${id} input exists`); const v = m[0].match(/\bvalue="([^"]*)"/); return v ? v[1] : null; };
ok(inputValue("sav-devices") === "25", "devices default 25");
ok(inputValue("sav-incidents") === "2", "incidents per device per month default 2");
ok(Number(inputValue("sav-minutes")) === DEFAULT_MINUTES_PER_FIX && DEFAULT_MINUTES_PER_FIX === 20, `minutes per incident default == roi.mjs DEFAULT_MINUTES_PER_FIX (${DEFAULT_MINUTES_PER_FIX})`);
ok(/ARIA's default estimate per fix/.test(page), "the minutes field is labelled ARIA's default estimate per fix");
ok(inputValue("sav-rate") === "45" && /Loaded hourly cost \(CA\$\)/.test(page), "loaded hourly cost default CA$45");
const share = page.match(/<input\b[^>]*\bid="sav-share"[^>]*>/)[0];
ok(/type="range"/.test(share) && /min="10"/.test(share) && /max="90"/.test(share) && /value="60"/.test(share), "share slider 10–90%, default 60%");
ok(inputValue("sav-fx") !== null && Number(inputValue("sav-fx")) > 0, "the USD→CAD rate is an input the visitor can change");
ok((page.match(/estimate from your inputs/gi) || []).length >= 6, "every output says 'estimate from your inputs'");
ok(/not a measured result/i.test(page), "no figure is presented as measured");
const calc = page.slice(page.indexOf('id="sentinel-savings"'), page.indexOf('id="get-sentinel"'));
ok(!/\bfetch\s*\(/.test(calc), "the savings section makes no request");

// 7 — plan prices in the inline JSON == pricing-tiers.mjs, and == what /plans shows.
const json = JSON.parse(page.match(/<script type="application\/json" id="sentinel-plan-prices">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(json.plans.map((p) => p.plan), [...CLIENT_PLANS], "one entry per client plan, in order"); checks++;
ok(json.currency === "USD" && /Billed monthly &middot; USD/.test(plansPage), "the prices are USD, as /plans states");
for (const p of json.plans) {
  const t = TIERS[p.plan];
  ok(p.label === t.label, `${p.plan}: label`);
  ok(p.priceMonthly === t.priceMonthly && p.priceMonthlyDisplay === t.priceMonthlyDisplay, `${p.plan}: ${p.priceMonthlyDisplay}/mo == pricing-tiers.mjs`);
  ok(p.billedAnnually === Boolean(t.billedAnnually), `${p.plan}: billing`);
  ok(p.priceYearly === (t.billedAnnually ? t.price : null), `${p.plan}: yearly price`);
  ok(p.seats === t.seats, `${p.plan}: seats`);
  ok(plansPage.includes(`<div class="pf-price">${t.priceMonthlyDisplay}<span class="pf-unit">/mo</span></div>`), `/plans shows ${p.plan} at ${t.priceMonthlyDisplay}/mo`);
  if (t.billedAnnually) ok(plansPage.includes(`$${t.price.toLocaleString("en-US")}/yr`), `/plans shows ${p.plan} at $${t.price.toLocaleString("en-US")}/yr`);
}
ok(json.plans.find((p) => p.plan === "personal").maxDevices === 1 && TIERS.personal.seats.includes("1 device"), "Personal is counted as one device, as its seats say");

// 8 — the release file keeps its contract; the page reads it the way the contract says.
const rel = JSON.parse(read("downloads/sentinel-release.json"));
assert.deepEqual(Object.keys(rel).sort(), ["updatedAt", "version", "windows"], "release file keys: version, windows, updatedAt"); checks++;
const pkg = JSON.parse(read("ARIA Sentinel/package.json"));
ok(/^\d+\.\d+\.\d+$/.test(rel.version) && rel.version === pkg.version, `release version ${rel.version} == ARIA Sentinel/package.json ${pkg.version}`);
ok(decode(byId("rel-version")) === rel.version, "the page's static version matches the release file");
ok(typeof rel.updatedAt === "string" && !Number.isNaN(Date.parse(rel.updatedAt)), "updatedAt is an ISO date");
if (rel.windows === null) {
  ok(true, "windows: null — the emailed pilot build copy stays");
} else {
  const w = rel.windows;
  assert.deepEqual(Object.keys(w).sort(), ["publishedAt", "sha256", "signed", "sizeBytes", "url"], "windows entry keys"); checks++;
  ok(/^(https:\/\/|\/(?!\/))\S+$/.test(w.url), "windows.url is https or site-relative");
  ok(/^[0-9a-f]{64}$/i.test(w.sha256), "windows.sha256 is 64 hex");
  ok(Number.isInteger(w.sizeBytes) && w.sizeBytes > 0, "windows.sizeBytes is a positive integer");
  ok(typeof w.signed === "boolean", "windows.signed is a boolean");
  ok(!Number.isNaN(Date.parse(w.publishedAt)), "windows.publishedAt is an ISO date");
}
ok(/'\.\/sentinel-release\.json'/.test(page) && /cache: 'no-store'/.test(page), "the page fetches ./sentinel-release.json with cache: 'no-store'");
ok(/Windows pilot build\.<\/b> The installer and your license key are emailed after checkout/.test(page), "windows:null / a failed fetch leaves the emailed pilot-build copy");
ok(/not yet code-signed, so Windows SmartScreen/.test(byId("rel-download")), "an unsigned download carries the SmartScreen note");
ok(/id="rel-download" hidden/.test(page) && /id="rel-unsigned" hidden/.test(page), "the download panel is hidden until the file says there is a download");
ok(/<a class="rel-link" href="\/plans\/">/.test(page) && /href="\/plans\/"/.test(page), "the View plans link goes to /plans/");
ok(/<a class="rel-link" href="#tiers">/.test(page) && /<section class="cards" id="tiers">/.test(page), "Subscribe points at the existing SUBSCRIBE grid");
ok(/<a class="rel-link" href="\/services\.html">/.test(page) && fs.existsSync(path.join(root, "services.html")), "Managed services goes to the real services page");

// 9 — nothing internal on the page or in its script. (The only "ahmad" allowed is the existing contact address.)
for (const [name, text] of [["downloads/index.html", page], ["assets/sentinel-sim.js", simSrc], ["assets/sentinel-sim.css", read("assets/sentinel-sim.css")], ["downloads/sentinel-release.json", read("downloads/sentinel-release.json")]]) {
  ok(!/\bAhmad\b/.test(text), `${name}: no "Ahmad"`);
  ok(!/ahmad/i.test(text.split("ahmad.wasee@iisupp.net").join("")), `${name}: no "ahmad" outside the published contact address`);
  ok(!/cowork/i.test(text), `${name}: no "Cowork"`);
  ok(!/vault/i.test(text), `${name}: no "vault"`);
  ok(!/Private pics/i.test(text), `${name}: no private folder name`);
}

// 10 — HTML sanity on the added sections; unique ids; the page still works at phone width.
const start = page.indexOf('<section class="sim" id="sentinel-sim"');
const endMark = page.indexOf("</section>", page.indexOf('<section class="rel" id="get-sentinel"'));
ok(start > 0 && endMark > start, "the added sections are in the page");
const region = page.slice(start, endMark + "</section>".length).replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const stack = [];
for (const m of region.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
  const [, close, tag0, selfClose] = m;
  const tag = tag0.toLowerCase();
  if (VOID.has(tag) || selfClose) continue;
  if (!close) { stack.push(tag); continue; }
  assert.equal(stack.pop(), tag, `balanced </${tag}> in the added sections`);
}
assert.equal(stack.length, 0, `no unclosed tags in the added sections (${stack.join(",")})`); checks++;
const ids = [...page.replace(/<script\b[\s\S]*?<\/script>/gi, "").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepEqual(dup, [], `ids are unique on /downloads/ (${dup.join(", ")})`); checks++;
ok(/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(page), "the page lays out at the phone's width (its own 420/480/680 px breakpoints apply)");

// 11 — the existing sell page is intact: states, forms, tier keys, held markers, honest delivery copy.
ok(page.includes('id="checkout-success"') && page.includes('id="checkout-cancel"') && /state === 'cancel' \|\| state === 'canceled' \|\| state === 'cancelled'/.test(page), "post-checkout states intact");
assert.deepEqual([...page.matchAll(/data-tier="([^"]+)"/g)].map((m) => m[1]), ["sentinel_personal_m", "sentinel_pro_m", "sentinel_business_y", "sentinel_midsize_y", "sentinel_enterprise_y"], "the five SUBSCRIBE keys, unchanged and not duplicated"); checks++;
ok(/name="sentinel-notify"/.test(page) && /iis-fineprint:start/.test(page) && /iis-fineprint:end/.test(page), "notify form and fine print intact");
for (const marker of ["dl-card", "AVAILABLE NOW", "aria-sentinel-windows.exe"]) ok(!page.includes(marker), `held marker "${marker}" absent`);
ok(!/coming soon/i.test(page), "no 'coming soon'");
ok(!/24\/7 (human )?support/i.test(page.replace(/No tier includes 24\/7 human support/g, "")), "no 24/7 promise");
ok(!/\bsigned installer\b/i.test(page.replace(/not yet code-signed/g, "")), "no claim of a signed installer");

console.log(`sentinel-downloads-page passed (${checks} checks: banner verbatim · 3 scenarios == advisoryCopy for every notice · legend == ruleSentence() · recipes/ROI/prices == app modules · release contract · no network in the sim · no internal names · existing sell page intact).`);
