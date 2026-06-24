// RUN 20 §5 — symptom causes are re-ranked against the LIVE system context: a low-probability cause
// jumps to the top when the machine's state confirms it (e.g. "slow" + RAM 95% → high-RAM cause first).
import assert from "node:assert/strict";
import { rankCauses, contextBoost } from "../src/shared/diagnostic-reasoner.mjs";

// A deliberately LOW-probability RAM cause sits behind two higher-probability causes...
const causes = [
  { name: "Too many startup programs", probability: 45, detection: "many startup items in system-context" },
  { name: "Background malware", probability: 35, detection: "unknown process consuming cpu" },
  { name: "High RAM (memory) usage", probability: 20, detection: "system-context.json ram.percentUsed is high" }
];

// ...with no context, ranking follows probability.
assert.equal(rankCauses(causes, {})[0].name, "Too many startup programs", "probability order with no context");

// ...but when the live machine shows RAM 95% used, the RAM cause is boosted to the top.
const ranked = rankCauses(causes, { ram: { percentUsed: 95 } });
assert.equal(ranked[0].name, "High RAM (memory) usage", "live high-RAM bumps the RAM cause to #1");
assert.ok(ranked[0].boost >= 50, "context boost applied");

// CPU + disk signals boost their respective causes too.
assert.ok(contextBoost({ detection: "cpu.load high" }, { cpu: { load: 92 } }) >= 50, "CPU boost");
assert.ok(contextBoost({ detection: "disk.percentFree low" }, { disk: { percentFree: 4 } }) >= 50, "disk boost");
// No boost when the context does NOT confirm the signal.
assert.equal(contextBoost({ detection: "ram high" }, { ram: { percentUsed: 30 } }), 0, "no boost when context is healthy");

console.log("Diagnostic-reasoner-system-aware test passed (live context re-ranks causes; healthy context = no boost).");
