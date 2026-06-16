import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const statePath = path.join(repoRoot, "senior-director-state", "ceo-action-console-state.json");
const dataPath = path.join(repoRoot, "senior-director-state", "ceo-action-console-data.json");
const port = Number(process.env.CEO_ACTION_CONSOLE_PORT || 8791);
const host = "127.0.0.1";

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"]
]);

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": `http://${host}:${port}`,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function saveState(nextState) {
  const current = readJson(statePath, { version: 1, actions: {}, notes: [] });
  const merged = {
    ...current,
    ...nextState,
    version: 1,
    updatedAt: new Date().toISOString(),
    actions: { ...(current.actions || {}), ...(nextState.actions || {}) },
    contracts: { ...(current.contracts || {}), ...(nextState.contracts || {}) },
    notes: [...(current.notes || []), ...(nextState.notes || [])].slice(-200)
  };
  fs.writeFileSync(statePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath === "/" ? "/ceo-action-console.html" : urlPath);
  const clean = decoded.replace(/^\/+/, "");
  const resolved = path.resolve(repoRoot, clean);
  if (!resolved.startsWith(repoRoot)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");

  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if (req.method === "GET" && url.pathname === "/api/console-data") {
    return send(res, 200, JSON.stringify(readJson(dataPath, { sections: [] })), "application/json; charset=utf-8");
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    return send(res, 200, JSON.stringify(readJson(statePath, { version: 1, actions: {}, notes: [] })), "application/json; charset=utf-8");
  }

  if (req.method === "POST" && url.pathname === "/api/state") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        return send(res, 200, JSON.stringify(saveState(payload)), "application/json; charset=utf-8");
      } catch (error) {
        return send(res, 400, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
      }
    });
    return;
  }

  if (req.method !== "GET") return send(res, 405, "Method not allowed");

  const target = safePath(url.pathname);
  if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    return send(res, 404, "Not found");
  }

  const ext = path.extname(target).toLowerCase();
  send(res, 200, fs.readFileSync(target), mime.get(ext) || "application/octet-stream");
});

server.listen(port, host, () => {
  console.log(`CEO Action Console running at http://${host}:${port}/`);
});
