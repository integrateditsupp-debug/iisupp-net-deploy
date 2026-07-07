import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(".");
const OUT_ROOT = path.resolve("..", "outputs", `aria-sentinel-browser-extension-proof-${stamp()}`);
const SOURCE_EXTENSION_DIR = path.resolve(process.env.ARIA_SENTINEL_EXTENSION_DIR || "chrome-extension");
const EXTENSION_DIR = path.join(OUT_ROOT, "extension-under-test");
const DEBUG_PORT = 39241;
const POPUP_CHAT_PROMPT = "ERR_NAME_NOT_RESOLVED browser DNS";
const EXPECTED_BUILD_MARKER = "web-chat-20260707";

const SCENARIOS = [
  {
    id: "404",
    path: "/404",
    expectedTitle: "Page not found",
    action: "walkthrough",
    html: page("Missing route", "<h1>404 - page not found</h1><p>The app route was not found.</p>")
  },
  {
    id: "cache",
    path: "/cache",
    expectedTitle: "This page looks stale",
    action: "resolve",
    html: page("Stale cache", "<h1>ChunkLoadError: loading chunk failed</h1><p>stale cache service worker old page</p>")
  },
  {
    id: "security",
    path: "/security",
    expectedTitle: "Suspicious site warning",
    action: "live-help",
    html: page("Deceptive site ahead", "<h1>Deceptive site ahead</h1><p>Suspicious site security warning. Do not enter credentials.</p>")
  }
];

fs.mkdirSync(OUT_ROOT, { recursive: true });
fs.cpSync(SOURCE_EXTENSION_DIR, EXTENSION_DIR, { recursive: true });

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("Chrome executable not found.");
    process.exit(1);
  }

  const server = await startFixtureServer();
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const profileDir = path.join(OUT_ROOT, "chrome-profile");
  fs.mkdirSync(profileDir, { recursive: true });

  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    `--load-extension=${EXTENSION_DIR}`,
    `--disable-extensions-except=${EXTENSION_DIR}`,
    "--enable-logging=stderr",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--window-size=1280,900",
    "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: false });
  const chromeLog = fs.createWriteStream(path.join(OUT_ROOT, "chrome.log"));
  chrome.stdout.pipe(chromeLog);
  chrome.stderr.pipe(chromeLog);

  const results = [];
  let popupChat = { ok: false, error: "not_run" };
  try {
    await waitForDevTools();
    fs.writeFileSync(path.join(OUT_ROOT, "devtools-targets-before.json"), JSON.stringify(await listTargets(), null, 2));
    for (const scenario of SCENARIOS) {
      const result = await runScenario(baseUrl, scenario);
      results.push(result);
    }
    const extensionId = await findAriaExtensionId();
    popupChat = await runPopupChatProof(extensionId);
    fs.writeFileSync(path.join(OUT_ROOT, "devtools-targets-after.json"), JSON.stringify(await listTargets(), null, 2));
    writeReport({
      ok: results.every((r) => r.ok) && popupChat.ok,
      chromePath,
      sourceExtensionDir: SOURCE_EXTENSION_DIR,
      extensionDir: EXTENSION_DIR,
      extensionId,
      baseUrl,
      results,
      popupChat
    });
  } finally {
    try { chrome.kill(); } catch {}
    await new Promise((resolve) => server.instance.close(resolve));
  }

  if (!results.every((r) => r.ok) || !popupChat.ok) process.exit(1);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #101010; color: #f5ead2; font: 18px Georgia, serif; }
    main { width: min(760px, calc(100vw - 40px)); padding: 42px; border: 1px solid rgba(197,160,89,.45); border-radius: 24px; background: #17130c; box-shadow: 0 24px 70px rgba(0,0,0,.5); }
    h1 { color: #e7bf69; margin-top: 0; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

async function startFixtureServer() {
  const instance = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const scenario = SCENARIOS.find((item) => item.path === url.pathname);
    if (!scenario) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(page("404 Not Found", "<h1>404 - page not found</h1>"));
      return;
    }
    res.writeHead(scenario.id === "404" ? 404 : 200, { "content-type": "text/html; charset=utf-8" });
    res.end(scenario.html);
  });
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return { instance, port: instance.address().port };
}

async function runScenario(baseUrl, scenario) {
  const target = await newTarget(`${baseUrl}${scenario.path}`);
  const cdp = await CdpSession.connect(target.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await sleep(1700);
    const before = await readCard(cdp);
    const beforePath = path.join(OUT_ROOT, `${scenario.id}-before.png`);
    await screenshot(cdp, beforePath);
    let after = before;
    let afterPath = "";
    let click = null;
    if (scenario.action) {
      click = await clickAction(cdp, scenario.action);
      await sleep(scenario.action === "resolve" ? 2500 : 2000);
      after = await readCard(cdp);
      afterPath = path.join(OUT_ROOT, `${scenario.id}-after-${scenario.action}.png`);
      await screenshot(cdp, afterPath);
    }
    const actionOk = actionPassed(scenario.action, click, after, scenario.expectedTitle);
    const ok = Boolean(before.hasRoot && before.sentinelBuild === EXPECTED_BUILD_MARKER && before.title === scenario.expectedTitle && actionOk);
    return {
      id: scenario.id,
      ok,
      url: `${baseUrl}${scenario.path}`,
      expectedTitle: scenario.expectedTitle,
      action: scenario.action,
      click,
      before,
      after,
      expectedBuildMarker: EXPECTED_BUILD_MARKER,
      screenshots: [beforePath, afterPath].filter(Boolean)
    };
  } finally {
    cdp.close();
  }
}

async function findAriaExtensionId() {
  const targets = await listTargets();
  const target = targets.find((item) => /chrome-extension:\/\/[^/]+\/background\.js$/.test(item.url || ""));
  const match = target?.url?.match(/^chrome-extension:\/\/([^/]+)\//);
  if (!match) throw new Error("ARIA Sentinel extension service worker was not found in DevTools targets");
  return match[1];
}

async function runPopupChatProof(extensionId) {
  const url = `chrome-extension://${extensionId}/popup.html`;
  const target = await newTarget(url);
  const cdp = await CdpSession.connect(target.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await sleep(1400);
    const before = await readPopup(cdp);
    const beforePath = path.join(OUT_ROOT, "popup-chat-before.png");
    await screenshot(cdp, beforePath);
    const click = await fillPopupChatAndSend(cdp, POPUP_CHAT_PROMPT);
    await sleep(8500);
    const after = await readPopup(cdp);
    const afterPath = path.join(OUT_ROOT, "popup-chat-after.png");
    await screenshot(cdp, afterPath);
    const combined = after.messages.map((item) => item.text).join("\n");
    const ok = Boolean(
      before.hasOpenAriaWeb &&
      before.sentinelBuild === EXPECTED_BUILD_MARKER &&
      click.ok &&
      after.messages.some((item) => item.role.includes("aria") && item.text && !/could not respond/i.test(item.text)) &&
      /iisupp\.net\/aria|ARIA web chat/i.test(combined)
    );
    return {
      ok,
      url,
      prompt: POPUP_CHAT_PROMPT,
      click,
      before,
      after,
      expectedBuildMarker: EXPECTED_BUILD_MARKER,
      screenshots: [beforePath, afterPath]
    };
  } finally {
    cdp.close();
  }
}

async function clickAction(cdp, action) {
  const selector = action === "resolve"
    ? '[data-action="resolve"]'
    : action === "live-help"
      ? '[data-action="live-help"]'
      : '[data-action="walkthrough"]';
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.querySelector("#aria-sentinel-root");
      const button = root && root.querySelector(${JSON.stringify(selector)});
      if (!button) return { ok: false };
      const rect = button.getBoundingClientRect();
      return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: button.textContent || "" };
    })()`,
    returnByValue: true
  });
  const point = result.result.value || { ok: false };
  if (!point.ok) return point;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  return point;
}

async function fillPopupChatAndSend(cdp, text) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const input = document.querySelector("#input");
      const button = document.querySelector("#send");
      if (!input || !button) return { ok: false, reason: "missing_input_or_send_button" };
      input.focus();
      input.value = ${JSON.stringify(text)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const rect = button.getBoundingClientRect();
      return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: button.textContent || "" };
    })()`,
    returnByValue: true
  });
  const point = result.result.value || { ok: false };
  if (!point.ok) return point;
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  return point;
}

function actionPassed(action, click, after, expectedTitle) {
  if (!action) return true;
  if (!click || !click.ok) return false;
  if (action === "walkthrough") return after.title === "Walkthrough ready";
  if (action === "live-help") return after.liveHidden === false;
  if (action === "resolve") return after.title === "Fix applied" || after.title === expectedTitle;
  return true;
}

async function readCard(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.querySelector("#aria-sentinel-root");
      const card = root && root.querySelector(".aria-sentinel-card");
      if (!root || !card) return { hasRoot: Boolean(root), hasCard: Boolean(card), hidden: true };
      return {
        hasRoot: true,
        hasCard: true,
        sentinelBuild: root.dataset.sentinelBuild || "",
        hidden: card.hidden,
        chip: (card.querySelector(".aria-sentinel-chip") || {}).textContent || "",
        title: (card.querySelector("h2") || {}).textContent || "",
        body: (card.querySelector(".aria-sentinel-body") || {}).textContent || "",
        cause: (card.querySelector(".aria-sentinel-cause") || {}).textContent || "",
        recommendation: (card.querySelector(".aria-sentinel-recommendation") || {}).textContent || "",
        live: (card.querySelector(".aria-sentinel-live") || {}).textContent || "",
        liveHidden: Boolean((card.querySelector(".aria-sentinel-live") || {}).hidden)
      };
    })()`,
    returnByValue: true
  });
  return result.result.value || {};
}

async function readPopup(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const messages = [...document.querySelectorAll("#messages .message")].map((item) => ({
        role: item.className || "",
        text: item.textContent || ""
      }));
      return {
        title: document.title,
        sentinelBuild: document.documentElement.dataset.sentinelBuild || "",
        bridge: (document.querySelector("#bridge") || {}).textContent || "",
        hasOpenAriaWeb: Boolean(document.querySelector("#openAriaWeb")),
        statusText: (document.querySelector("#statusText") || {}).textContent || "",
        messages
      };
    })()`,
    returnByValue: true
  });
  return result.result.value || { messages: [] };
}

async function screenshot(cdp, file) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
}

async function newTarget(url) {
  const endpoint = `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`;
  let response = await fetch(endpoint, { method: "PUT" });
  if (!response.ok) response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Failed to open Chrome target: ${response.status}`);
  return response.json();
}

async function listTargets() {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function waitForDevTools() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome DevTools port did not become ready");
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || "CDP error"));
        else pending.resolve(message.result || {});
      }
    };
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new CdpSession(ws));
      ws.onerror = () => reject(new Error("CDP websocket failed"));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 10000);
    });
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

function writeReport(report) {
  const jsonPath = path.join(OUT_ROOT, "browser-extension-live-proof.json");
  const mdPath = path.join(OUT_ROOT, "browser-extension-live-proof.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, [
    "# ARIA Sentinel Browser Extension Live Proof",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Browser: ${report.chromePath}`,
    `Source extension bundle: ${report.sourceExtensionDir || report.extensionDir}`,
    `Loaded extension bundle: ${report.extensionDir}`,
    `Extension ID: ${report.extensionId || "(not found)"}`,
    "",
    "## Results",
    "",
    ...report.results.map((r) => [
      `### ${r.id}`,
      `- Status: ${r.ok ? "PASS" : "FAIL"}`,
      `- Expected card title: ${r.expectedTitle}`,
      `- Build marker: ${r.before.sentinelBuild || "(none)"}`,
      `- Observed card title: ${r.before.title || "(none)"}`,
      `- Action after screenshot: ${r.after.title || "(none)"}`,
      ...r.screenshots.map((s) => `- Screenshot: ${s}`)
    ].join("\n")),
    "",
    "### popup-chat",
    `- Status: ${report.popupChat.ok ? "PASS" : "FAIL"}`,
    `- Prompt: ${report.popupChat.prompt || POPUP_CHAT_PROMPT}`,
    `- Build marker: ${report.popupChat.after?.sentinelBuild || report.popupChat.before?.sentinelBuild || "(none)"}`,
    `- Bridge: ${report.popupChat.after?.bridge || report.popupChat.before?.bridge || "(unknown)"}`,
    `- Last response: ${lastPopupResponse(report.popupChat.after)}`,
    ...(report.popupChat.screenshots || []).map((s) => `- Screenshot: ${s}`)
  ].join("\n"));
  console.log(`Browser extension live proof ${report.ok ? "passed" : "failed"}: ${OUT_ROOT}`);
}

function lastPopupResponse(popup) {
  const messages = popup?.messages || [];
  const last = [...messages].reverse().find((item) => item.role.includes("aria") && item.text);
  return last ? last.text.replace(/\s+/g, " ").slice(0, 260) : "(none)";
}

function findChrome() {
  const edgeCandidates = [
    path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe")
  ];
  const chromeCandidates = [
    path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe")
  ];
  const preferred = String(process.env.ARIA_SENTINEL_BROWSER || "").toLowerCase();
  const candidates = preferred === "chrome"
    ? [...chromeCandidates, ...edgeCandidates]
    : preferred === "edge"
      ? edgeCandidates
      : [...edgeCandidates, ...chromeCandidates];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
