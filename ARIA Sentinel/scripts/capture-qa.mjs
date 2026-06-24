// QA capture harness — loads each surface in a real BrowserWindow and saves a PNG via
// webContents.capturePage(). Run: node_modules/.bin/electron scripts/capture-qa.mjs
// Renderers run on their built-in preview API (no preload), so the UI is fully populated.
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "design-review", "qa-4hr-pass-2026-06-19");
fs.mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Destroying the last window would otherwise auto-quit the app mid-run on Windows.
app.on("window-all-closed", (e) => e.preventDefault());

async function capture({ file, name, width, height, prep, transparent, settle = 900 }) {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    transparent: Boolean(transparent),
    backgroundColor: transparent ? "#00000000" : "#050505",
    webPreferences: { offscreen: false, contextIsolation: true, nodeIntegration: false }
  });
  let loaded = false;
  for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
    try {
      await Promise.race([
        win.loadFile(path.join(root, file)),
        wait(8000).then(() => Promise.reject(new Error("load timeout")))
      ]);
      loaded = true;
    } catch (err) {
      console.log(`load retry ${attempt + 1} for ${name}: ${err.message}`);
      await wait(400);
    }
  }
  if (!loaded) {
    win.destroy();
    throw new Error(`could not load ${file}`);
  }
  await wait(settle);
  if (prep) {
    try {
      await win.webContents.executeJavaScript(prep, true);
      await wait(700);
    } catch (err) {
      console.log(`prep failed for ${name}: ${err.message}`);
    }
  }
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, name), image.toPNG());
  console.log(`saved ${name} (${image.getSize().width}x${image.getSize().height})`);
  win.destroy();
  await wait(450); // let the GPU/compositor release before the next window
}

async function tryCapture(spec) {
  try {
    await capture(spec);
  } catch (err) {
    console.log(`SKIP ${spec.name}: ${err.message}`);
  }
}

app.whenReady().then(async () => {
  // 01 — floating globe (overlay, globe only)
  await tryCapture({ file: "src/renderer/overlay.html", name: "01_globe-floating.png", width: 220, height: 220, transparent: true });

  // 03 — fix card detected (overlay, card visible + populated)
  await tryCapture({
    file: "src/renderer/overlay.html",
    name: "03_fix-card-detected.png",
    width: 360,
    height: 260,

    prep: `
      document.body.classList.remove('globe-only'); document.body.classList.add('card-visible');
      const card = document.getElementById('overlayCard'); if (card) card.hidden = false;
      document.getElementById('overlayChip').textContent = 'DISK · LOW SPACE';
      document.getElementById('overlayTitle').textContent = 'Disk almost full';
      document.getElementById('overlayBody').textContent = "3% free on C:. I can recover ~4.2 GB by clearing temp files, browser caches and old downloads.";
      const g = document.querySelector('.aria-globe'); if (g) g.setAttribute('data-state','diagnosing');
      true;`
  });

  // settings — Mode tab
  await tryCapture({ file: "src/renderer/index.html", name: "07_settings-mode.png", width: 980, height: 680, settle: 1200 });

  // settings — Privacy verifier + restore points + transparency
  await tryCapture({
    file: "src/renderer/index.html",
    name: "08_settings-privacy.png",
    width: 980,
    height: 720,
    settle: 1200,
    prep: `document.querySelector('[data-tab="privacy"]').click(); true;`
  });

  // settings — ServiceNow + My incidents
  await tryCapture({
    file: "src/renderer/index.html",
    name: "09_settings-servicenow.png",
    width: 980,
    height: 720,
    settle: 1200,
    prep: `document.querySelector('[data-tab="servicenow"]').click(); true;`
  });

  // 04 — admin console overview
  await tryCapture({ file: "admin-console/index.html", name: "04_admin-console-overview.png", width: 1180, height: 820, settle: 1000 });

  // 05 — admin console recipes
  await tryCapture({
    file: "admin-console/index.html",
    name: "05_admin-console-recipes.png",
    width: 1180,
    height: 820,
    settle: 1000,
    prep: `document.querySelector('[data-view-target="recipes"]').click(); true;`
  });

  // 06 — chrome extension popup (static chrome)
  await tryCapture({ file: "chrome-extension/popup.html", name: "06_chrome-ext-popup.png", width: 360, height: 480, settle: 700 });

  console.log("QA capture complete →", outDir);
  app.quit();
}).catch((err) => {
  console.error("capture harness failed:", err);
  app.quit();
});
