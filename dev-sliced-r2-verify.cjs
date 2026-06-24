// Slice D Round 2 — verify on a real Chromium (Electron) via the network layer:
//  1. a free-form question actually fires a POST to /.netlify/functions/aria-chat with {messages, sessionId}
//  2. topic-bleed is gone: after a printer recipe, a free-form Q clears state.lastIntent (no bleed)
//  3. NEW CHAT and CLEAR both hard-reset the live session
const { app, BrowserWindow, session } = require("electron");
const os = require("os");
const path = require("path");
const INDEX = process.env.INDEX_HTML;
app.setPath("userData", path.join(os.tmpdir(), "aria-r2-" + process.pid + "-" + process.hrtime.bigint().toString()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const captured = [];
const send = (win, text) => win.webContents.executeJavaScript(
  `(()=>{const i=document.getElementById('askInput');i.value=${JSON.stringify(text)};document.getElementById('sendBtn').click();return true;})()`);
const intentNow = (win) => win.webContents.executeJavaScript(`(()=>{try{return String(state.lastIntent);}catch(e){return 'ERR:'+e.message;}})()`);

app.whenReady().then(async () => {
  // Network panel: capture every request to the aria-chat function + its POST body.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*aria-chat*", "file://*aria-chat*"] }, (details, cb) => {
    let body = "";
    try { const ud = details.uploadData && details.uploadData[0]; if (ud && ud.bytes) body = Buffer.from(ud.bytes).toString("utf8"); } catch (e) {}
    captured.push({ method: details.method, url: details.url, body });
    cb({ cancel: false });
  });

  const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { contextIsolation: true } });
  for (let i = 0; i < 4; i++) { try { await win.loadFile(INDEX); break; } catch (e) { await wait(1200); } }
  await wait(2400);
  await win.webContents.executeJavaScript(`(()=>{try{localStorage.setItem('aria_tour_done','1');}catch(e){}document.querySelectorAll('.iis-tour-skip').forEach(b=>b.click());return 1;})()`);
  await wait(500);

  // 1+2 — printer recipe, then a free-form question (should fire the LLM POST + clear lastIntent)
  await send(win, "my printer won't print and the print queue is stuck");
  await wait(2200);
  const intentAfterPrinter = await intentNow(win);
  await send(win, "what is the difference between RAM and storage?");
  await wait(2600);
  const intentAfterFreeform = await intentNow(win);

  // 3 — NEW CHAT hard reset
  await win.webContents.executeJavaScript(`(()=>{document.getElementById('newChatBtn').click();return 1;})()`);
  await wait(500);
  const afterNewChat = await win.webContents.executeJavaScript(`(()=>({intro:!!document.getElementById('introBlock'),userMsgs:document.querySelectorAll('#chatMessages .you-block').length,intent:String(state.lastIntent),llm:(state.llmHistory||[]).length}))()`);

  // build some state then CLEAR (hard reset + wipe archive)
  await send(win, "outlook won't open");
  await wait(1500);
  await win.webContents.executeJavaScript(`(()=>{document.getElementById('historyClear').click();return 1;})()`);
  await wait(500);
  const afterClear = await win.webContents.executeJavaScript(`(()=>({intro:!!document.getElementById('introBlock'),userMsgs:document.querySelectorAll('#chatMessages .you-block').length,intent:String(state.lastIntent),archived:(typeof chatHistory!=='undefined'?chatHistory.length:-1)}))()`);

  const llmCall = captured.find((c) => c.method === "POST" && /aria-chat/.test(c.url));
  let parsedBody = null; try { parsedBody = llmCall ? JSON.parse(llmCall.body) : null; } catch (e) {}
  console.log("=== Slice D R2 verification ===");
  console.log("1. aria-chat POST fired:", !!llmCall, "| url:", llmCall ? llmCall.url : "(none)");
  console.log("   body has messages[]:", !!(parsedBody && Array.isArray(parsedBody.messages)), "| has sessionId:", !!(parsedBody && parsedBody.sessionId), "| msgs:", parsedBody && parsedBody.messages ? parsedBody.messages.length : 0);
  console.log("2. topic-bleed: intent after printer =", intentAfterPrinter, "→ after free-form =", intentAfterFreeform, "(expect null = cleared, no bleed)");
  console.log("3. NEW CHAT reset:", JSON.stringify(afterNewChat));
  console.log("   CLEAR reset:", JSON.stringify(afterClear));
  const pass = !!llmCall && parsedBody && Array.isArray(parsedBody.messages) && parsedBody.sessionId &&
    intentAfterFreeform === "null" && afterNewChat.intro && afterNewChat.userMsgs === 0 && afterNewChat.llm === 0 &&
    afterClear.intro && afterClear.userMsgs === 0 && afterClear.archived === 0;
  console.log("=== RESULT:", pass ? "PASS" : "CHECK", "===");
  app.quit();
}).catch((e) => { console.error("harness error:", e); app.quit(); });
