// One-off UX capture (2026-07-03) — PROTECTED word (no dot) + polished SLA/KPI charts.
// Run: node_modules/.bin/electron scripts/capture-ux-2026-07-03.mjs
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "design-review", "ux-2026-07-03");
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.on("window-all-closed", (e) => e.preventDefault());

async function capture({ name, width, height, prep, settle = 1300 }) {
  const win = new BrowserWindow({ width, height, show: false, backgroundColor: "#050505",
    webPreferences: { contextIsolation: true, nodeIntegration: false } });
  await win.loadFile(path.join(root, "src/renderer/index.html"));
  await wait(settle);
  if (prep) { try { await win.webContents.executeJavaScript(prep, true); await wait(900); } catch (e) { console.log("prep fail", e.message); } }
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, name), img.toPNG());
  console.log(`saved ${name} (${img.getSize().width}x${img.getSize().height})`);
  win.destroy(); await wait(400);
}

app.whenReady().then(async () => {
  // Dashboard: hero PROTECTED (colored word, no dot) + KPI tiles.
  await capture({ name: "01_dashboard-protected.png", width: 1040, height: 760 });
  // Performance: live KPI bar chart with axis/gridlines.
  await capture({ name: "02_performance-chart.png", width: 1040, height: 760,
    prep: `document.querySelector('[data-tab="performance"]')?.click() || document.querySelector('#tab-performance')?.click(); true;` });
  // Force a real KPI chart render so the axis/gridlines are visible even before live data.
  await capture({ name: "03_kpi-chart-demo.png", width: 1040, height: 620,
    prep: `
      const host = document.querySelector('#perfChart') || document.querySelector('.kpi-chart') || document.body;
      if (window.__renderBarChartDemo) window.__renderBarChartDemo();
      true;` });
  app.quit();
});
