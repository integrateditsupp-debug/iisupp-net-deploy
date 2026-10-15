// PROD 2026-10-14 (audit R27 + R1/R3/R6/R8/R9/R10/R12/R13/R14/R15/R20) — the first DOM/runtime suite for the
// renderer: Playwright/Chromium drives the REAL src/renderer/index.html + renderer.js against a stubbed
// window.sentinel (tests/lib/renderer-harness.mjs). It proves what a brand-new owner actually SEES:
//   1. first run: ONE overlay (the wizard), finish with safe defaults in 2 clicks, Manual stays Manual, tour AFTER
//   2. the typed license key reaches enterLicense; the "What I'll do" choice + live-fixes wish are honoured
//   3. Customize keeps all 12 steps reachable; "You're all set" only on the LAST step; Skip on every step
//   4. a dashboard with data: What I found / did / need lists, honest SLA/compliance/endpoint/hotkey rows
//   5. trial expired: baseline usable, Manual never locked, honest lock copy, prices from pricing-tiers, yearly tab
//   6. the in-app countdown card + Cancel → cancelCountdown(id)
//   7. Stop / kill switch: rail + hero say STOPPED, Start re-arms, the kill toast is main's own sentence
//   8. Approve toast branches on result.ok
//   9. the on-device voice engine resolves from a relative path (no bare specifier)
//  10. 1366×768: the rail's last item is above the fold; no horizontal scroll; every input has a name
// OPT-IN: without Playwright + Chromium the suite SKIPS with a clear line (exit 0) — never a silent green.
import assert from "node:assert/strict";
import { available, withPage, firstLaunchState, expiredState, dashboardWithDataState, visible, text } from "./lib/renderer-harness.mjs";
import { TIERS, CLIENT_PLANS, priceLine, monthlyDisplay } from "../src/shared/pricing-tiers.mjs";

const env = available();
if (!env.ok) {
  console.log(`renderer-first-run: SKIPPED — ${env.reason}. (The suite is opt-in; it needs Playwright + a Chromium binary.)`);
} else {
  let n = 0; const t = () => { n++; };
  const KEY = "a".repeat(64);

  // 1 — first run: one overlay, quick path, Manual respected, tour after the wizard, dialog semantics.
  {
    const r = await withPage({ state: firstLaunchState() }, async (page) => {
      const out = {};
      out.overlays = {}; for (const id of ["#onboarding", "#setupWizard", "#planModal", "#lockedTabOverlay"]) out.overlays[id] = await visible(page, id);
      out.role = await page.evaluate(() => document.querySelector("#setupWizard").getAttribute("role") + "/" + document.querySelector("#setupWizard").getAttribute("aria-modal"));
      out.kicker = await text(page, "#setupKicker");
      out.skipVisible = await page.evaluate(() => !document.querySelector("#setupSkip").hidden);
      // Tab stays inside the dialog
      for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
      out.focusInside = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest("#setupWizard")));
      // Escape → the summary (never a silent close)
      await page.keyboard.press("Escape"); await page.waitForTimeout(60);
      out.afterEscape = { title: await text(page, "#setupTitle"), visible: await visible(page, "#setupWizard") };
      // back to the start, then the 2-click path
      await page.click("#setupBack"); await page.click("#setupBack"); await page.click("#setupBack"); await page.waitForTimeout(60);
      out.backAtHello = await text(page, "#setupKicker");
      await page.click("#setupSafeDefaults"); await page.waitForTimeout(80);
      out.summary = { title: await text(page, "#setupTitle"), next: await text(page, "#setupNext"), body: await text(page, "#setupBody") };
      await page.click("#setupNext"); await page.waitForTimeout(250);
      out.after = { wizard: await visible(page, "#setupWizard"), tour: await visible(page, "#onboarding"), prefs: await page.evaluate(() => (window.__calls.find((c) => c.fn === "completeSetup") || {}).args?.[0]) };
      await page.click("#onboardSkip"); await page.waitForTimeout(60);
      out.tourAfterSkip = await visible(page, "#onboarding");
      return out;
    });
    assert.deepEqual(r.errors, [], `no page errors on first run: ${r.errors.join(" | ")}`);
    assert.equal(r.result.overlays["#setupWizard"], "visible", "the wizard is on screen");
    assert.equal(r.result.overlays["#onboarding"], "hidden", "the coachmark tour is NOT stacked on the wizard");
    assert.equal(r.result.overlays["#planModal"], "hidden"); assert.equal(r.result.overlays["#lockedTabOverlay"], "hidden");
    assert.equal(r.result.role, "dialog/true", "the wizard is a real dialog");
    assert.equal(r.result.kicker, "Hello", "screen A is Hello");
    assert.equal(r.result.skipVisible, true, "Skip for now is visible on the first step");
    assert.equal(r.result.focusInside, true, "Tab never leaves the wizard");
    assert.equal(r.result.afterEscape.visible, "visible", "Escape does not silently close the wizard");
    assert.equal(r.result.afterEscape.title, "You're all set", "Escape goes to the summary");
    assert.equal(r.result.backAtHello, "Hello");
    assert.equal(r.result.summary.title, "You're all set", "the summary is the only 'all set'");
    assert.equal(r.result.summary.next, "Finish");
    assert.match(r.result.summary.body, /Live fixes: OFF/, "the summary states live fixes plainly");
    assert.match(r.result.summary.body, /Mode: Manual/, "safe defaults = Manual");
    assert.equal(r.result.after.wizard, "hidden", "Finish closes the wizard");
    assert.equal(r.result.after.tour, "visible", "the tour runs AFTER the wizard");
    assert.equal(r.result.after.prefs.mode, "manual", "Manual stays Manual");
    assert.equal(r.result.after.prefs.autonomyLevel, "approve-first", "the autonomy level follows Manual (never silently Confirmed)");
    assert.equal(r.result.after.prefs.notifyChannels.email, false, "email channel off without an email");
    assert.equal(r.result.tourAfterSkip, "hidden");
    t();
  }

  // 2 — Who are you + What I'll do: key kept + verified, choice + live-fixes honoured.
  {
    const r = await withPage({ state: firstLaunchState() }, async (page) => {
      await page.click("#setupNext"); await page.waitForTimeout(60); // → Who are you
      const who = await text(page, "#setupKicker");
      await page.fill("#setupUserName", "Sam"); await page.fill("#setupUserEmail", "sam@acme.com"); await page.fill("#setupLicense", KEY);
      await page.click("#setupNext"); await page.waitForTimeout(60); // → What I'll do
      const what = await text(page, "#setupKicker");
      await page.click('[data-what-card="fix-safe"]');
      await page.check("#setupLiveFixes");
      await page.click("#setupNext"); await page.waitForTimeout(60); // → summary
      const summary = await text(page, "#setupBody");
      await page.click("#setupNext"); await page.waitForTimeout(300);
      const calls = await page.evaluate(() => window.__calls);
      return { who, what, summary, calls, wizard: await visible(page, "#setupWizard") };
    });
    assert.deepEqual(r.errors, [], r.errors.join(" | "));
    assert.equal(r.result.who, "Who are you"); assert.equal(r.result.what, "What I'll do");
    assert.match(r.result.summary, /Mode: Confirmed/); assert.match(r.result.summary, /Live fixes: ON/); assert.match(r.result.summary, /License key: will be verified/);
    const cs = r.result.calls.find((c) => c.fn === "completeSetup").args[0];
    assert.equal(cs.mode, "confirmed"); assert.equal(cs.autonomyLevel, "safe-auto"); assert.equal(cs.deviceUser.name, "Sam"); assert.equal(cs.deviceUser.email, "sam@acme.com");
    assert.equal(cs.notifyChannels.email, true, "an entered email turns the email channel on");
    const lic = r.result.calls.find((c) => c.fn === "enterLicense");
    assert.ok(lic && lic.args[0].key === KEY, "the typed license key reaches enterLicense");
    const lf = r.result.calls.find((c) => c.fn === "setLiveFixes");
    assert.ok(lf && lf.args[0].enabled === true, "the live-fixes wish is written through the consent gate");
    assert.equal(r.result.wizard, "hidden");
    t();
  }

  // 3 — Customize: all 12 steps + summary reachable; mid-way "Done" is not "all set"; Skip from any step.
  {
    const r = await withPage({ state: firstLaunchState() }, async (page) => {
      await page.click("#setupCustomize"); await page.waitForTimeout(60);
      const dots = await page.evaluate(() => document.querySelectorAll("#setupDots span").length);
      const titles = [];
      for (let i = 0; i < 13; i++) {
        titles.push({ kicker: await text(page, "#setupKicker"), title: await text(page, "#setupTitle"), skip: await page.evaluate(() => !document.querySelector("#setupSkip").hidden) });
        if (i === 2) await page.check('input[name="setupMode"][value="manual"]');
        if (i < 12) { await page.click("#setupNext"); await page.waitForTimeout(40); }
      }
      // go back to step 2 and Skip from there
      for (let i = 0; i < 11; i++) { await page.click("#setupBack"); await page.waitForTimeout(20); }
      const atStep = await text(page, "#setupKicker");
      await page.click("#setupSkip"); await page.waitForTimeout(60);
      const skipped = await text(page, "#setupTitle");
      await page.click("#setupNext"); await page.waitForTimeout(200);
      const prefs = await page.evaluate(() => (window.__calls.find((c) => c.fn === "completeSetup") || {}).args?.[0]);
      return { dots, titles, atStep, skipped, prefs };
    });
    assert.deepEqual(r.errors, [], r.errors.join(" | "));
    assert.equal(r.result.dots, 13, "12 original steps + the summary");
    assert.equal(r.result.titles[5].kicker, "Done"); assert.notEqual(r.result.titles[5].title, "You're all set", "'all set' is never said at step 6 of 13");
    assert.equal(r.result.titles[12].title, "You're all set", "…only on the last step");
    assert.ok(r.result.titles.slice(0, 12).every((x) => x.skip), "Skip for now is on every step before the summary");
    assert.equal(r.result.titles[12].skip, false);
    assert.equal(r.result.atStep, "License"); assert.equal(r.result.skipped, "You're all set", "Skip jumps to the summary");
    assert.equal(r.result.prefs.mode, "manual"); assert.equal(r.result.prefs.autonomyLevel, "approve-first");
    t();
  }

  // 4 — dashboard with data: the three plain lists + honest rows everywhere.
  {
    const r = await withPage({ state: dashboardWithDataState() }, async (page) => {
      const out = {};
      out.found = await page.evaluate(() => [...document.querySelectorAll("#homeFound .home-row")].map((r) => r.textContent.replace(/\s+/g, " ")));
      out.did = await page.evaluate(() => [...document.querySelectorAll("#homeDid .home-row")].map((r) => r.textContent.replace(/\s+/g, " ")));
      out.need = await page.evaluate(() => [...document.querySelectorAll("#homeNeed .home-row")].map((r) => r.textContent.replace(/\s+/g, " ")));
      out.sub = await text(page, "#heroSubline"); out.watch = await text(page, "#homeWatch"); out.canfix = await text(page, "#homeCanFix");
      out.sla = await text(page, "#slaComposite"); out.slaNote = await text(page, "#slaComplianceNote");
      out.breachTile = await page.evaluate(() => document.querySelector('.kpi-tile[data-kpi="breaches"] .kpi-value')?.textContent);
      out.trust = await text(page, "#trustStrip");
      out.chunks = await text(page, "#ariaChatChunks");
      await page.click('.nav-item[data-tab="compliance-privacy"]'); await page.waitForTimeout(150);
      out.privacy = await text(page, "#compPrivacy"); out.r11 = await text(page, "#compR11"); out.endpoints = await page.evaluate(() => [...document.querySelectorAll("#compEndpoints .health-row")].map((r) => r.className + ":" + r.textContent.replace(/\s+/g, " ")));
      out.upload = await text(page, "#dataUploadCount");
      await page.click('.nav-item[data-tab="settings"]'); await page.waitForTimeout(150);
      out.hotkeys = await page.evaluate(() => [...document.querySelectorAll("#hotkeyStatus .table-row")].map((r) => r.textContent.replace(/\s+/g, " ")));
      out.staticActive = await page.evaluate(() => [...document.querySelectorAll("#settings .table-row .active-badge")].filter((e) => !e.closest("#hotkeyStatus")).length);
      await page.click('.nav-item[data-tab="dashboard"]'); await page.waitForTimeout(100);
      await page.click('#homeFound [data-home-fix="printer-spooler-v1"]'); await page.waitForTimeout(150);
      out.fixCall = await page.evaluate(() => (window.__calls.find((c) => c.fn === "supervisedFix") || {}).args?.[0]);
      out.fixStatus = await page.evaluate(() => document.querySelector("#homeFound .resolve-status")?.textContent);
      out.countdown = await visible(page, "#countdownCard");
      return out;
    });
    assert.deepEqual(r.errors, [], r.errors.join(" | "));
    assert.equal(r.result.found.length, 2, "What I found lists the detections"); assert.match(r.result.found[0], /Printer stuck/); assert.match(r.result.found[0], /Fix it/); assert.match(r.result.found[0], /Show me/);
    assert.ok(r.result.did.some((x) => /Verified:/.test(x)) && r.result.did.some((x) => /Applied:/.test(x)) && r.result.did.some((x) => /Previewed \(nothing changed\)/.test(x)) && r.result.did.some((x) => /Cancelled before it ran/.test(x)), `What I did rows: ${r.result.did.join(" || ")}`);
    assert.ok(r.result.need.some((x) => /Say yes to: Renew network address/.test(x)) && r.result.need.some((x) => /Queued: Restart Windows Update services/.test(x)), `What I need rows: ${r.result.need.join(" || ")}`);
    assert.doesNotMatch(r.result.sub, /threats blocked/, "no '0 threats blocked'"); assert.match(r.result.sub, /5 events scanned/);
    assert.match(r.result.watch, /Watching: disk · services · network · crashes · performance · event log — last check \d+ s ago/);
    assert.match(r.result.canfix, /can apply 2 vetted fixes on Windows \(1 need administrator approval/); assert.match(r.result.canfix, /Live fixes: off/);
    assert.equal(r.result.sla, "SLA not measured yet"); assert.match(r.result.slaNote, /nothing to score/);
    assert.equal(r.result.breachTile, "--", "breaches are -- until measured");
    assert.doesNotMatch(r.result.trust, /100% sanitization/);
    assert.match(r.result.chunks, /KB size: —/);
    assert.match(r.result.privacy, /not run yet/); assert.doesNotMatch(r.result.privacy, /REVIEW/); assert.doesNotMatch(r.result.privacy, /100%/);
    assert.match(r.result.r11, /excluded folders: 1/); assert.doesNotMatch(r.result.r11, /Private pics/i);
    assert.ok(r.result.endpoints.some((x) => /endpoint-na/.test(x) && /not available in this version/.test(x)), `ok:null renders grey: ${r.result.endpoints.join(" || ")}`);
    assert.equal(r.result.upload, "0");
    assert.equal(r.result.hotkeys.length, 4, "hotkey rows come from state.hotkeys"); assert.ok(r.result.hotkeys.some((x) => /Ctrl \+ Alt \+ P.*Failed/.test(x)), "a failed registration is shown as failed");
    assert.equal(r.result.staticActive, 0, "no static 'Active' badge rows remain");
    assert.equal(r.result.fixCall.mode, "confirmed"); assert.equal(r.result.fixCall.recipeId, "printer-spooler-v1");
    assert.match(r.result.fixStatus, /Applying in 10s/); assert.equal(r.result.countdown, "visible", "the countdown card appears in-app");
    t();
  }

  // 5 — trial expired: baseline usable, Manual never locked, honest lock copy, prices from pricing-tiers.
  {
    const r = await withPage({ state: expiredState() }, async (page) => {
      const out = {};
      out.nav = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".nav-item")].map((b) => [b.dataset.tab, b.classList.contains("tab-locked")])));
      out.badge = await text(page, "#trialBadge"); out.acct = await text(page, "#accountStatus"); out.license = await text(page, "#licenseStatus");
      out.startTrialHidden = await page.evaluate(() => document.querySelector("#startTrial").hidden);
      await page.click('.nav-item[data-tab="settings"]'); await page.waitForTimeout(100);
      out.modes = await page.evaluate(() => [...document.querySelectorAll(".mode-row")].map((b) => ({ mode: b.dataset.mode, locked: b.classList.contains("locked") })));
      await page.click('.mode-row[data-mode="manual"]'); await page.waitForTimeout(60);
      out.setMode = await page.evaluate(() => (window.__calls.find((c) => c.fn === "setMode") || {}).args);
      await page.click('.mode-row[data-mode="confirmed"]'); await page.waitForTimeout(60);
      out.toasts = await page.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent.replace(/\s+/g, " ")));
      await page.evaluate(() => document.querySelector('.nav-item[data-tab="control-center"]').click()); await page.waitForTimeout(100); // aria-disabled: a DOM click, as a person's would land
      out.locked = { visible: await visible(page, "#lockedTabOverlay"), msg: await text(page, "#lockedTabMessage"), info: await text(page, "#lockedTabTrialInfo"), keepHidden: await page.evaluate(() => document.querySelector("#lockedTabKeepWalkthrough").hidden), kicker: await text(page, "#lockedTabKicker") };
      await page.click("#lockedTabChoosePlan"); await page.waitForTimeout(100);
      out.plan = { visible: await visible(page, "#planModal"), kicker: await text(page, "#planModalKicker"), updates: await text(page, "#planModalUpdates"), support: await text(page, "#planSupportNote"), cards: await page.evaluate(() => [...document.querySelectorAll("#planModal .plan-card")].map((c) => ({ tier: c.dataset.tier, price: c.querySelector(".plan-price").innerText.replace(/\s+/g, ""), note: c.querySelector(".plan-note")?.textContent }))) };
      await page.click('[data-plan-billing="yearly"]'); await page.waitForTimeout(60);
      out.yearly = await page.evaluate(() => [...document.querySelectorAll("#planModal .plan-card")].map((c) => ({ tier: c.dataset.tier, price: c.querySelector(".plan-price").innerText.replace(/\s+/g, ""), note: c.querySelector(".plan-note")?.textContent })));
      await page.click('#planModal .plan-subscribe[data-plan="pro"]'); await page.waitForTimeout(60);
      out.choose = await page.evaluate(() => (window.__calls.find((c) => c.fn === "choosePlan") || {}).args);
      out.details = await page.evaluate(() => document.querySelector("#planDetails").getAttribute("data-support"));
      out.undefinedAnywhere = await page.evaluate(() => /undefined/.test(document.body.innerText));
      return out;
    });
    assert.deepEqual(r.errors, [], r.errors.join(" | "));
    for (const tab of ["dashboard", "aria", "settings"]) assert.equal(r.result.nav[tab], false, `${tab} navigable`);
    for (const tab of ["control-center", "recipes", "reports"]) assert.equal(r.result.nav[tab], true, `${tab} locked`);
    assert.equal(r.result.badge, "Trial ended"); assert.match(r.result.acct, /Trial ended/); assert.match(r.result.license, /30-day trial ended/); assert.match(r.result.license, /Dashboard, ARIA chat, Manual mode and Settings keep working/);
    assert.equal(r.result.startTrialHidden, true, "no 'Start trial' once it already ran");
    assert.equal(r.result.modes.find((m) => m.mode === "manual").locked, false, "Manual is never locked"); assert.equal(r.result.modes.find((m) => m.mode === "confirmed").locked, true);
    assert.equal(r.result.setMode && r.result.setMode[0], "manual", "clicking Manual switches to Manual");
    assert.ok(r.result.toasts.some((x) => x.includes("Confirmed mode is a Pro feature") && x.includes(monthlyDisplay("pro"))), `the upsell quotes the pricing-tiers price: ${r.result.toasts.join(" || ")}`);
    assert.equal(r.result.locked.visible, "visible"); assert.equal(r.result.locked.kicker, "Trial ended"); assert.match(r.result.locked.msg, /30-day ARIA Sentinel trial has ended/); assert.match(r.result.locked.msg, /ARIA chat, Manual mode and Settings keep working/); assert.doesNotMatch(r.result.locked.msg, /Walk-Through/i, "no walk-through promise without the entitlement");
    assert.equal(r.result.locked.keepHidden, true); assert.match(r.result.locked.info, /trial ended/);
    assert.equal(r.result.plan.visible, "visible"); assert.equal(r.result.plan.kicker, "Trial ended"); assert.equal(r.result.plan.updates, "Updates: manual in this version"); assert.match(r.result.plan.support, /separate, quote-based/);
    for (const c of r.result.plan.cards) { const pl = priceLine(c.tier, "monthly"); assert.equal(c.price, `${pl.amount}${pl.unit}`, `${c.tier} monthly price from pricing-tiers`); if (TIERS[c.tier].billedAnnually) assert.match(c.note, /billed annually/); }
    for (const c of r.result.yearly) { const pl = priceLine(c.tier, "yearly"); assert.equal(c.price, `${pl.amount}/yr`, `${c.tier} yearly price`); assert.match(c.note, /billed annually/); }
    assert.deepEqual(r.result.choose, ["pro", { billing: "yearly" }], "choosePlan carries the billing period");
    assert.equal(r.result.details, "https://iisupp.net/plans/?from=app");
    assert.equal(r.result.undefinedAnywhere, false, "no 'undefined' anywhere on screen");
    t();
  }

  // 6 — the in-app countdown card + Cancel; 7 — run state honesty; 8 — the approve toast.
  {
    const r = await withPage({ state: dashboardWithDataState() }, async (page) => {
      const out = {};
      await page.evaluate(() => window.__emit("countdownTick", { id: "cd-9", secondsLeft: 7, recipeId: "printer-spooler-v1", title: "Printer stuck / queue frozen", canCancel: true }));
      await page.waitForTimeout(50);
      out.card = { visible: await visible(page, "#countdownCard"), secs: await text(page, "#countdownSeconds"), title: await text(page, "#countdownTitle") };
      await page.click("#countdownCancel"); await page.waitForTimeout(80);
      out.cancel = await page.evaluate(() => (window.__calls.find((c) => c.fn === "cancelCountdown") || {}).args);
      out.cardAfter = await visible(page, "#countdownCard");
      out.toast1 = await page.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent.replace(/\s+/g, " ")).slice(-1)[0]);
      // run state: Stop ARIA → stopped
      await page.evaluate(() => window.__emit("state", { ...window.__state, ariaStopped: true }));
      await page.waitForTimeout(50);
      out.stopped = { rail: await text(page, "#railStatus"), hero: await text(page, "#heroStatus"), sub: await text(page, "#heroSubline"), watch: await text(page, "#homeWatch"), start: await page.evaluate(() => document.querySelector("#startAria").disabled), stop: await page.evaluate(() => document.querySelector("#stopAria").disabled) };
      // back to running, then the kill switch
      await page.evaluate(() => window.__emit("state", { ...window.__state, ariaStopped: false }));
      await page.waitForTimeout(50);
      out.running = { rail: await text(page, "#railStatus"), hero: await text(page, "#heroStatus") };
      await page.evaluate(() => window.__emit("killSwitch", { toast: "ARIA terminated — nothing to undo.", killedCount: 0, undone: false, undoAvailable: false }));
      await page.waitForTimeout(50);
      out.killed = { rail: await text(page, "#railStatus"), hero: await text(page, "#heroStatus"), start: await page.evaluate(() => document.querySelector("#startAria").disabled), toast: await page.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent.replace(/\s+/g, " ")).slice(-1)[0]) };
      // approve toast
      await page.click('.nav-item[data-tab="control-center"]'); await page.waitForTimeout(100);
      await page.click("#approvalsList [data-approve]"); await page.waitForTimeout(100);
      out.approve = await page.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent.replace(/\s+/g, " ")).slice(-1)[0]);
      return out;
    });
    assert.deepEqual(r.errors, [], r.errors.join(" | "));
    assert.equal(r.result.card.visible, "visible"); assert.equal(r.result.card.secs, "7"); assert.match(r.result.card.title, /Printer stuck/);
    assert.deepEqual(r.result.cancel, ["cd-9"], "Cancel aborts THIS countdown by id"); assert.equal(r.result.cardAfter, "hidden"); assert.match(r.result.toast1, /Cancelled/);
    assert.match(r.result.stopped.rail, /stopped/); assert.equal(r.result.stopped.hero, "STOPPED"); assert.match(r.result.stopped.sub, /ARIA is stopped/); assert.match(r.result.stopped.watch, /Not watching/);
    assert.equal(r.result.stopped.start, false, "Start re-armed"); assert.equal(r.result.stopped.stop, true);
    assert.match(r.result.running.rail, /watching/); assert.equal(r.result.running.hero, "PROTECTED");
    assert.match(r.result.killed.rail, /kill switch/); assert.equal(r.result.killed.hero, "STOPPED"); assert.equal(r.result.killed.start, false, "Start re-armed after the kill switch");
    assert.match(r.result.killed.toast, /ARIA terminated — nothing to undo\./); assert.doesNotMatch(r.result.killed.toast, /last action undone/);
    assert.match(r.result.approve, /did not run/); assert.match(r.result.approve, /live fixes are off/i);
    t();
  }

  // 9 — the on-device voice engine resolves by relative path (no bare specifier); 10 — layout + input names.
  {
    const r = await withPage({ state: dashboardWithDataState(), viewport: { width: 1366, height: 768 } }, async (page, ctx) => {
      const out = {};
      out.engine = await page.evaluate(async () => { try { const m = await import("/src/renderer/local-stt.mjs"); const v = await m.loadVoskEngine(); return { ok: typeof v.createModel === "function" }; } catch (e) { return { ok: false, error: String(e && e.message || e) }; } });
      out.layout = await page.evaluate(() => { const items = [...document.querySelectorAll(".nav-item")]; const last = items[items.length - 1].getBoundingClientRect(); return { lastNavBottom: last.bottom, innerHeight: innerHeight, hScroll: document.documentElement.scrollWidth > innerWidth, railScrolls: getComputedStyle(document.querySelector(".settings-rail")).overflowY }; });
      out.unlabeled = await page.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, select")].filter((i) => { const id = i.id; const lab = id && document.querySelector(`label[for="${id}"]`); return !lab && !i.closest("label") && !i.getAttribute("aria-label") && !i.getAttribute("aria-labelledby"); }).map((i) => i.id || i.placeholder || i.name));
      out.noteContrast = await page.evaluate(() => getComputedStyle(document.querySelector("#approvalsNote")).color);
      out.dialogs = await page.evaluate(() => [...document.querySelectorAll(".onboarding")].map((d) => d.id + ":" + d.getAttribute("role")));
      return out;
    });
    assert.deepEqual(r.errors, [], r.errors.join(" | "));
    assert.equal(r.result.engine.ok, true, `the Vosk engine loads from its relative path: ${JSON.stringify(r.result.engine)}`);
    assert.ok(r.result.layout.lastNavBottom <= r.result.layout.innerHeight, `the last rail item (Settings) is above the fold at 768 px (bottom ${r.result.layout.lastNavBottom})`);
    assert.equal(r.result.layout.hScroll, false, "no horizontal scroll at 1366"); assert.equal(r.result.layout.railScrolls, "auto");
    assert.deepEqual(r.result.unlabeled, [], `every input has an accessible name: ${r.result.unlabeled.join(", ")}`);
    assert.equal(r.result.noteContrast, "rgb(143, 143, 143)", ".note uses the AA muted token");
    assert.ok(r.result.dialogs.every((d) => /:dialog$/.test(d)), `every modal is a dialog: ${r.result.dialogs.join(", ")}`);
    t();
  }

  assert.equal(n, 7, "7 renderer-first-run groups");
  console.log(`renderer-first-run test passed (${n} groups · one overlay + 2-click safe-defaults finish · key → enterLicense · Customize keeps 12 steps · honest home/SLA/compliance/hotkeys · expired baseline + pricing-tiers prices + yearly · countdown Cancel → cancelCountdown(id) · STOPPED/kill honesty · approve toast on result.ok · voice engine relative path · 768 fit + labels + AA note).`);
}
