import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = [
  path.join(root, "src"),
  path.join(root, "chrome-extension"),
  path.join(root, "docs"),
  path.join(root, "..", "netlify", "functions", "aria-recipes.mjs"),
  path.join(root, "..", "netlify", "functions", "aria-stop-codes.mjs")
];

const allowedHosts = [
  "iisupp.net",
  "127.0.0.1:37841",
  "localhost:37841",
  "{customer-instance}.service-now.com",
  "customer.service-now.com",
  // Q-DIR slice 2 — the customer's own Entra directory integration (opt-in, admin-consented, like
  // ServiceNow above). Read-only in this slice; writes need write scopes + admin consent (later slice).
  "graph.microsoft.com",
  "login.microsoftonline.com",
  "www.w3.org",
  "example.com",
  "wa.me"
];

const findings = [];

for (const entry of sourceRoots) {
  for (const file of listFiles(entry)) {
    const rel = path.relative(root, file);
    if (/\.png$|\.jpg$|\.jpeg$|\.pptx$|\.ico$/i.test(file)) continue;
    if (/\.env/i.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (rel.startsWith(`chrome-extension${path.sep}`)) {
      assert.ok(!text.includes("OPENAI_API_KEY"), `${rel} must not reference OPENAI_API_KEY`);
      assert.ok(!text.includes("api.openai.com"), `${rel} must not call OpenAI directly`);
    }
    const urls = text.match(/https?:\/\/[^\s"'`)<>]+/g) || [];
    for (const url of urls) {
      if (url.includes("${")) continue;
      let host = "";
      try {
        host = new URL(url).host;
      } catch {
        findings.push({ file: rel, url, reason: "invalid-url" });
        continue;
      }
      if (!allowedHosts.includes(host)) findings.push({ file: rel, url });
    }
  }
}

assert.deepEqual(findings, [], `Unexpected outbound URLs: ${JSON.stringify(findings, null, 2)}`);

console.log("Privacy audit passed.");

function* listFiles(entry) {
  if (!fs.existsSync(entry)) return;
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    yield entry;
    return;
  }
  for (const child of fs.readdirSync(entry)) {
    if (["node_modules", "dist"].includes(child)) continue;
    yield* listFiles(path.join(entry, child));
  }
}
