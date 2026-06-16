import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statePath = path.join(repoRoot, "senior-director-state", "ceo-action-console-state.json");
const dataPath = path.join(repoRoot, "senior-director-state", "ceo-action-console-data.json");
const outPath = path.join(repoRoot, "senior-director-state", "linkedin-notes-agent-routing-2026-06-12.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const state = readJson(statePath);
const data = readJson(dataPath);
const actions = (data.sections || []).flatMap((section) => section.actions || []);
const byId = new Map(actions.map((action) => [action.id, action]));
const now = new Date().toISOString();
const routed = [];

for (const [id, saved] of Object.entries(state.actions || {})) {
  const action = byId.get(id);
  const isLinkedInAcceptance = id.startsWith("acceptance-") || action?.sectionId === "linkedin-checks" || action?.group === "LinkedIn acceptance checks";
  if (isLinkedInAcceptance && saved.status === "open" && saved.note && saved.note.trim()) {
    state.actions[id] = {
      ...saved,
      status: "agent",
      updatedAt: now,
      title: saved.title || action?.title || id
    };
    routed.push({ id, title: state.actions[id].title, note: saved.note.trim() });
    state.notes = [
      ...(state.notes || []),
      {
        actionId: id,
        title: state.actions[id].title,
        status: "agent",
        note: saved.note.trim(),
        at: now
      }
    ].slice(-200);
  }
}

const md = `# LinkedIn Notes Routed To Agent

Generated: ${now}

Routed noted LinkedIn acceptance items from open dashboard queue to Needs Agent.

Count: ${routed.length}

${routed.length ? routed.map((item, index) => `${index + 1}. ${item.title}\n   - Note: ${item.note}`).join("\n\n") : "- None routed."}

Agent instruction:
- Check acceptance only through allowed logged-in user flow.
- If not accepted, keep prospect pending and move to new lead finding.
- If accepted, prepare a draft message and bring it back to the CEO dashboard for Ahmad to send/adjust.
- No scraping, no mass automation, no autonomous send/connect/message.
`;

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
fs.writeFileSync(outPath, md, "utf8");

console.log(JSON.stringify({ ok: true, routed: routed.length, outPath }, null, 2));
