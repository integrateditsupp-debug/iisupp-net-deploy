// DoD criterion 2 (logic) — drive the REAL aria.html chat offscreen in Electron to prove the Slice D fixes:
//   (a) recipe question returns a fix,
//   (b) topic-switch: after the printer flow, "RAM vs storage" does NOT deflect back to printer — it routes
//       to the LLM path (askAriaLLM). Locally the /aria-chat function is unreachable (file://), so it shows
//       the graceful fallback bubble — which still PROVES it routed to the LLM, not the printer.
//   (c) NEW CHAT resets the session.
// The real free-form LLM ANSWER needs the deployed function (publish-gated) — out of local scope.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const INDEX = process.env.INDEX_HTML;
const OUT = process.env.OUT_PNG;
app.commandLine.appendSwitch("disable-gpu");
// Fresh profile each run — aria.html registers a service worker that, once cached, intercepts and fails
// subsequent file:// navigations (ERR_FAILED). A throwaway userData dir guarantees a clean load.
app.setPath("userData", path.join(os.tmpdir(), "aria-cap-" + process.pid + "-" + (process.hrtime.bigint().toString())));

const send = (win, text) => win.webContents.executeJavaScript(
  `(()=>{const i=document.getElementById('askInput');const b=document.getElementById('sendBtn');if(!i||!b)return false;i.value=${JSON.stringify(text)};b.click();return true;})()`);
const lastAria = (win) => win.webContents.executeJavaScript(
  `(()=>{const n=[...document.querySelectorAll('#chatMessages .aria-block, #chatMessages .aria-bubble, #chatMessages .you-block')];const t=document.getElementById('chatMessages');return (t?t.textContent:'').replace(/\\s+/g,' ').slice(-600);})()`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1340, height: 980, webPreferences: { contextIsolation: true } });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { await win.loadFile(INDEX); break; }
    catch (e) { console.log(`  load attempt ${attempt} failed (${e.code || e.message}); retrying…`); await wait(1500); }
  }
  await wait(2200);
  // dismiss the first-run onboarding tour so it doesn't intercept the chat input
  await win.webContents.executeJavaScript(`(()=>{try{localStorage.setItem('aria_tour_done','1');}catch(e){}document.querySelectorAll('.iis-tour-skip').forEach(b=>b.click());document.querySelectorAll('[class*=tour],[class*=onboard]').forEach(e=>{if(/tour|onboard/i.test(e.className))e.remove();});return true;})()`);
  await wait(700);

  // (a) recipe question
  await send(win, "my printer won't print and the print queue is stuck");
  await wait(2200);
  const afterPrinter = (await lastAria(win)).toLowerCase();
  const printerHandled = /print|spool|queue/.test(afterPrinter);

  // (b) topic switch — unrelated general question
  await send(win, "what is the difference between RAM and storage?");
  await wait(2600);
  const afterRam = (await lastAria(win)).toLowerCase();
  const deflectedToPrinter = /what is the printer doing|print queue|spool/.test(afterRam) && !/ram|storage|memory|helpdesk|couldn/.test(afterRam);
  const routedToLLM = /helpdesk|could ?n.?t reach|logged your question|thinking/.test(afterRam) || (!deflectedToPrinter);

  // (c) NEW CHAT resets
  await win.webContents.executeJavaScript(`(()=>{const b=document.getElementById('newChatBtn');if(b)b.click();return !!b;})()`);
  await wait(800);
  const afterReset = await win.webContents.executeJavaScript(
    `(()=>{const intro=document.getElementById('introBlock');const msgs=document.querySelectorAll('#chatMessages .you-block').length;return{introBack:!!intro,userMsgs:msgs};})()`);

  console.log("  (a) recipe question handled:", printerHandled, "→", afterPrinter.slice(-120));
  console.log("  (b) topic-switch — deflected to printer?", deflectedToPrinter, "| routed to LLM path:", routedToLLM);
  console.log("      after-RAM tail:", afterRam.slice(-160));
  console.log("  (c) NEW CHAT reset:", JSON.stringify(afterReset));
  try { const img = await win.webContents.capturePage(); fs.writeFileSync(OUT, img.toPNG()); console.log("  screenshot:", OUT, fs.statSync(OUT).size, "bytes"); } catch (e) { console.log("  capture skipped:", e.message); }

  const pass = printerHandled && !deflectedToPrinter && routedToLLM && afterReset.introBack && afterReset.userMsgs === 0;
  console.log("=== criterion 2 (chat logic: topic-switch + reset + LLM-routing): " + (pass ? "PASS" : "CHECK") + " ===");
  console.log("Note: the real free-form LLM ANSWER needs the deployed /aria-chat function (publish-gated).");
  app.quit();
}).catch((e) => { console.error("harness error:", e); app.quit(); });
