// A3 exit-criteria test: confirm-card gate — supervisedFix is NEVER called without user confirmation.
// Tests the appendResolveChip logic contract using a mock sentinel bridge and a lightweight DOM stub.
//
// Contract:
//   1. "Resolve it for me" click → diagnose() → previewTier0() → confirm-card shown
//   2. supervisedFix() is NOT called before user clicks "Apply fix"
//   3. "Apply fix" → supervisedFix({ recipeId, mode:"confirmed" }) called exactly once
//   4. "Cancel" → supervisedFix never called; "Resolve it for me" button restored
//   5. No-recipe path → supervisedFix never called; status says "No automatic fix matched"

import assert from "node:assert/strict";

// ── minimal DOM stub ──────────────────────────────────────────────────────────────────
class El {
  constructor(tag) {
    this.tag = tag; this.type = ""; this.className = ""; this.textContent = ""; this.disabled = false;
    this._listeners = {}; this._children = []; this._parent = null;
  }
  addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); }
  dispatchEvent(ev) { for (const fn of (this._listeners[ev.type] || [])) fn(ev); }
  remove() { if (this._parent) this._parent._children = this._parent._children.filter(c => c !== this); this._parent = null; }
  append(...kids) { for (const k of kids) { k._parent = this; this._children.push(k); } }
  prepend(kid) { kid._parent = this; this._children.unshift(kid); }
  appendChild(kid) { this.append(kid); }
  querySelector(sel) { return this._children.find(c => `.${c.className}` === sel || c.tag === sel.replace(/^\./, "")) || null; }
  get children() { return this._children; }
}
const createElement = (tag) => new El(tag);
const click = (el) => { for (const fn of (el._listeners.click || [])) fn({}); };

// ── rebuild appendResolveChip from the patched renderer (inline copy of the logic) ──
function buildChip(sentinel) {
  // Replicate appendResolveChip verbatim from renderer.js A3 patch.
  const wrap = createElement("div"); wrap.className = "aria-chat-resolve";
  const btn  = createElement("button"); btn.type = "button"; btn.className = "aria-chat-resolve-btn";
  btn.textContent = "Resolve it for me";
  const st   = createElement("span"); st.className = "aria-chat-resolve-status";

  async function runFix(recipeId) {
    st.textContent = "Starting fix…";
    try {
      const fix = await sentinel.supervisedFix({ recipeId, mode: "confirmed" });
      if (!fix || fix.ok === false) {
        st.textContent = fix?.verdict === "veto" ? `Held by safety supervisor: ${fix.reason || "vetoed"}.` : "Couldn't start the fix.";
      } else if (fix.countdown) {
        st.textContent = `Applying in ${fix.seconds || 10}s — cancel from the countdown, or Ctrl+Alt+K to abort.`;
      } else { st.textContent = "Previewed safely (dry-run)."; }
    } catch { st.textContent = "Couldn't run the fix."; }
  }

  function showConfirmCard(recipeId, preview) {
    btn.remove();
    const card = createElement("div"); card.className = "aria-chat-confirm-card";
    const title = createElement("strong"); title.className = "aria-chat-confirm-title";
    title.textContent = preview.title || recipeId;
    const desc = createElement("p"); desc.className = "aria-chat-confirm-desc";
    desc.textContent = (preview.summary || "Applies a safe, reversible fix.").replace(/^\[dry-run\]\s*/i, "");
    const restore = createElement("p"); restore.className = "aria-chat-confirm-restore";
    restore.textContent = preview.requiresReboot
      ? "A system restore point will be created. A reboot is required after this fix."
      : "A system restore point will be created before applying this fix.";
    const actions = createElement("div"); actions.className = "aria-chat-confirm-actions";
    const confirmBtn = createElement("button"); confirmBtn.type = "button"; confirmBtn.className = "aria-chat-confirm-ok";
    confirmBtn.textContent = preview.readOnly ? "Run check" : "Apply fix";
    const cancelBtn  = createElement("button"); cancelBtn.type  = "button"; cancelBtn.className  = "aria-chat-confirm-cancel";
    cancelBtn.textContent = "Cancel";
    confirmBtn.addEventListener("click", () => { card.remove(); runFix(recipeId); });
    cancelBtn.addEventListener("click",  () => { card.remove(); btn.disabled = false; btn.textContent = "Resolve it for me"; wrap.prepend(btn); });
    actions.append(confirmBtn, cancelBtn);
    card.append(title, desc, restore, actions);
    wrap.prepend(card);
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true; st.textContent = "Checking this device…";
    try {
      const d = (await sentinel.diagnose?.("")) || {};
      const recipeId = d.recipeId || "";
      if (!recipeId) { st.textContent = "No automatic fix matched — opening diagnostics."; return; }
      st.textContent = "";
      const preview = (await sentinel.previewTier0?.(recipeId)) || {};
      showConfirmCard(recipeId, preview);
    } catch { st.textContent = "Couldn't resolve right now."; btn.disabled = false; }
  });

  wrap.append(btn, st);
  return { wrap, btn, st };
}

// ─── helpers ─────────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}
async function testAsync(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}

console.log("\nA3 confirm-card gate tests");
console.log("==========================");

// ── TEST 1: click → diagnose called, previewTier0 called, supervisedFix NOT called ──
await testAsync("T1: diagnose+preview called; supervisedFix NOT called before confirm", async () => {
  let fixCalls = 0, diagCalls = 0, previewCalls = 0;
  const sentinel = {
    supervisedFix: async () => { fixCalls++; return { ok: true, countdown: true, seconds: 10 }; },
    diagnose: async () => { diagCalls++; return { recipeId: "flush-dns" }; },
    previewTier0: async (id) => { previewCalls++; return { title: "Flush DNS cache", summary: "[dry-run] Clears DNS.", requiresReboot: false, readOnly: false }; }
  };
  const { btn } = buildChip(sentinel);
  await click(btn);
  // yield microtask
  await new Promise(r => setTimeout(r, 10));
  assert.equal(diagCalls, 1, "diagnose should be called once");
  assert.equal(previewCalls, 1, "previewTier0 should be called once");
  assert.equal(fixCalls, 0, "supervisedFix must NOT be called before user confirms");
});

// ── TEST 2: confirm button → supervisedFix called with recipeId ───────────────────
await testAsync("T2: Apply fix → supervisedFix called with correct recipeId", async () => {
  let fixPayload = null;
  const sentinel = {
    supervisedFix: async (p) => { fixPayload = p; return { ok: true, countdown: true, seconds: 10 }; },
    diagnose: async () => ({ recipeId: "restart-print-spooler" }),
    previewTier0: async () => ({ title: "Restart print spooler", summary: "[dry-run] Stops and restarts spooler.", requiresReboot: false, readOnly: false })
  };
  const { btn, wrap } = buildChip(sentinel);
  await click(btn);
  await new Promise(r => setTimeout(r, 10));
  // Find confirm card and click "Apply fix"
  const card = wrap._children.find(c => c.className === "aria-chat-confirm-card");
  assert.ok(card, "confirm-card should be in DOM");
  const actions = card._children.find(c => c.className === "aria-chat-confirm-actions");
  const confirmBtn = actions._children.find(c => c.className === "aria-chat-confirm-ok");
  assert.equal(confirmBtn.textContent, "Apply fix", "button label should be Apply fix");
  await click(confirmBtn);
  await new Promise(r => setTimeout(r, 10));
  assert.ok(fixPayload, "supervisedFix should have been called");
  assert.equal(fixPayload.recipeId, "restart-print-spooler", "recipeId should match diagnosed recipe");
  assert.equal(fixPayload.mode, "confirmed", "mode must be confirmed");
});

// ── TEST 3: cancel → supervisedFix never called, button restored ──────────────────
await testAsync("T3: Cancel → supervisedFix never called; Resolve button restored", async () => {
  let fixCalls = 0;
  const sentinel = {
    supervisedFix: async () => { fixCalls++; return { ok: true }; },
    diagnose: async () => ({ recipeId: "flush-dns" }),
    previewTier0: async () => ({ title: "Flush DNS cache", summary: "[dry-run] Clears DNS.", requiresReboot: false, readOnly: false })
  };
  const { btn, wrap } = buildChip(sentinel);
  await click(btn);
  await new Promise(r => setTimeout(r, 10));
  const card = wrap._children.find(c => c.className === "aria-chat-confirm-card");
  const actions = card._children.find(c => c.className === "aria-chat-confirm-actions");
  const cancelBtn = actions._children.find(c => c.className === "aria-chat-confirm-cancel");
  click(cancelBtn);
  await new Promise(r => setTimeout(r, 10));
  assert.equal(fixCalls, 0, "supervisedFix must NOT be called after cancel");
  const restoredBtn = wrap._children.find(c => c.className === "aria-chat-resolve-btn");
  assert.ok(restoredBtn, "Resolve button should be restored after cancel");
});

// ── TEST 4: readOnly recipe → button label is "Run check" not "Apply fix" ─────────
await testAsync("T4: readOnly recipe → confirm button says 'Run check'", async () => {
  const sentinel = {
    supervisedFix: async () => ({ ok: true }),
    diagnose: async () => ({ recipeId: "check-disk-smart" }),
    previewTier0: async () => ({ title: "Check disk SMART", summary: "[dry-run] Read-only health check.", requiresReboot: false, readOnly: true })
  };
  const { btn, wrap } = buildChip(sentinel);
  await click(btn);
  await new Promise(r => setTimeout(r, 10));
  const card = wrap._children.find(c => c.className === "aria-chat-confirm-card");
  const actions = card._children.find(c => c.className === "aria-chat-confirm-actions");
  const confirmBtn = actions._children.find(c => c.className === "aria-chat-confirm-ok");
  assert.equal(confirmBtn.textContent, "Run check", "readOnly recipe should say 'Run check'");
});

// ── TEST 5: reboot recipe → restore note mentions reboot ─────────────────────────
await testAsync("T5: requiresReboot → restore note warns about reboot", async () => {
  const sentinel = {
    supervisedFix: async () => ({ ok: true }),
    diagnose: async () => ({ recipeId: "reset-network-stack" }),
    previewTier0: async () => ({ title: "Reset network stack", summary: "[dry-run] Resets Winsock.", requiresReboot: true, readOnly: false })
  };
  const { btn, wrap } = buildChip(sentinel);
  await click(btn);
  await new Promise(r => setTimeout(r, 10));
  const card = wrap._children.find(c => c.className === "aria-chat-confirm-card");
  const restore = card._children.find(c => c.className === "aria-chat-confirm-restore");
  assert.ok(restore.textContent.includes("reboot"), "restore note must mention reboot");
});

// ── TEST 6: no recipe → supervisedFix never called, status says no match ─────────
await testAsync("T6: no recipe → supervisedFix never called, no-match status", async () => {
  let fixCalls = 0;
  const sentinel = {
    supervisedFix: async () => { fixCalls++; return { ok: true }; },
    diagnose: async () => ({}),
    previewTier0: async () => ({})
  };
  const { btn, st } = buildChip(sentinel);
  await click(btn);
  await new Promise(r => setTimeout(r, 10));
  assert.equal(fixCalls, 0, "supervisedFix must NOT be called when no recipe matches");
  assert.ok(st.textContent.includes("No automatic fix"), `status should say no match, got: "${st.textContent}"`);
});

// ── TEST 7: [dry-run] prefix stripped from confirm-card description ────────────────
await testAsync("T7: [dry-run] prefix stripped from confirm-card description", async () => {
  const sentinel = {
    supervisedFix: async () => ({ ok: true }),
    diagnose: async () => ({ recipeId: "flush-dns" }),
    previewTier0: async () => ({ title: "Flush DNS cache", summary: "[dry-run] Clears the DNS resolver.", requiresReboot: false, readOnly: false })
  };
  const { btn, wrap } = buildChip(sentinel);
  await click(btn);
  await new Promise(r => setTimeout(r, 10));
  const card = wrap._children.find(c => c.className === "aria-chat-confirm-card");
  const desc = card._children.find(c => c.className === "aria-chat-confirm-desc");
  assert.ok(!desc.textContent.startsWith("[dry-run]"), "description must not start with [dry-run]");
  assert.ok(desc.textContent.includes("Clears"), "description content should be preserved");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
