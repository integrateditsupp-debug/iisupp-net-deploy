// IIS Forums — app logic (static, hash-routed, vanilla ES module; no framework).
// Solutions search runs on the REAL offline KB via forums-retriever.mjs (same scoring +
// abstain threshold as the site's aria-kb-query function). Discussions are a REAL Netlify
// Blobs store (forums-threads function). Identity reuses the site's existing session
// (localStorage aria_session_email + the aria-magic-link function) — reading never needs it.
// Rule 14 everywhere: real numbers or honest empty/no-match states; nothing decorative.
import { toDoc, retrieve, summarize, stripFrontmatter, normalizeConfidence, ABSTAIN_THRESHOLD } from "/assets/forums-retriever.mjs";

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const FN = "/.netlify/functions/forums-threads";
const SESSION_KEY = "aria_session_email";

// ── tiny safe markdown (text → escaped HTML: paragraphs, code fences, inline code, bold, lists)
function md(text) {
  const t = esc(String(text || ""));
  const fenced = t.replace(/```([\s\S]*?)```/g, (_, code) => `<div class="codewell">${code.trim()}</div>`);
  return fenced.split(/\n{2,}/).map((p) => {
    if (p.includes('class="codewell"')) return p;
    const lines = p.split(/\n/);
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    if (/^###\s/.test(p)) return `<h3>${inline(p.replace(/^###\s*/, ""))}</h3>`;
    if (/^##\s/.test(p)) return `<h2>${inline(p.replace(/^##\s*/, ""))}</h2>`;
    if (/^#\s/.test(p)) return `<h2>${inline(p.replace(/^#\s*/, ""))}</h2>`;
    return `<p>${inline(p).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
const inline = (s) => s
  .replace(/`([^`]+)`/g, '<code class="mono">$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
  .replace(/@([a-z0-9_-]{2,24})/gi, '<span class="mention">@$1</span>');

// ── toasts (role=status wrapper lives in the DOM)
function toast(msg, kind) {
  const el = document.createElement("div");
  el.className = "toast" + (kind === "err" ? " err" : "");
  el.innerHTML = `<span class="led" aria-hidden="true"></span><span>${esc(msg)}</span><button aria-label="Dismiss">✕</button>`;
  el.querySelector("button").onclick = () => el.remove();
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ── session (reuse the site's existing identity; never required to read)
const getEmail = () => { try { return localStorage.getItem(SESSION_KEY) || ""; } catch { return ""; } };
let ssoReturnFocus = null;
function requireSignIn(then) {
  if (getEmail()) return then();
  const modal = $("#ssoModal");
  ssoReturnFocus = document.activeElement;
  modal.classList.add("on");
  modal._then = then;
  $("#ssoEmail").focus();
}
function closeSso() {
  $("#ssoModal").classList.remove("on");
  if (ssoReturnFocus) { try { ssoReturnFocus.focus(); } catch { /* gone */ } ssoReturnFocus = null; }
}
$("#ssoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("#ssoEmail").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast("Enter a valid work email.", "err"); return; }
  try { localStorage.setItem(SESSION_KEY, email); } catch { /* private mode */ }
  // Best-effort: fire the existing magic-link flow so the session can be verified by email.
  fetch("/.netlify/functions/aria-magic-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "request", email }) }).catch(() => {});
  paintSession();
  const then = $("#ssoModal")._then;
  closeSso();
  toast("Signed in for this device. A verification link was requested to your email.");
  if (then) then();
});
$("#ssoClose").addEventListener("click", closeSso);
$("#ssoModal").addEventListener("keydown", (e) => { if (e.key === "Escape") closeSso(); });
$("#ssoBtn").addEventListener("click", () => requireSignIn(() => toast(`Signed in as ${getEmail()}`)));
function paintSession() {
  const email = getEmail();
  $("#ssoBtn").textContent = email ? email[0].toUpperCase() : "·";
  $("#ssoBtn").setAttribute("aria-label", email ? `Signed in as ${email}` : "Sign in with IIS SSO");
}

// ── KB (the real thing — loaded once, count shown only after it truly loads)
let DOCS = null, CATS = [];
async function loadKb() {
  if (DOCS) return DOCS;
  const res = await fetch("/assets/aria-kb-chunks.json");
  if (!res.ok) throw new Error("kb fetch " + res.status);
  const raw = await res.json();
  DOCS = (Array.isArray(raw) ? raw : raw.chunks || []).map(toDoc);
  // Rail shows the 10 largest real categories (with true doc counts); the rest stay searchable.
  const counts = {};
  for (const d of DOCS) counts[d.category] = (counts[d.category] || 0) + 1;
  CATS = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10);
  $("#kbCount").textContent = String(DOCS.length);
  $("#catFilter").innerHTML = CATS.map((c) => `<label><input type="checkbox" value="${esc(c)}" checked> ${esc(c)} <span class="tert" style="margin-left:auto">${counts[c]}</span></label>`).join("");
  return DOCS;
}

// ── graduated community answers join Solutions as discussion-sourced docs (real, gold-badged)
let GRAD = null;
async function loadGraduated() {
  if (GRAD) return GRAD;
  try {
    const r = await fetchFn({ op: "list" });
    const rows = (r.threads || []).filter((t) => t.graduated);
    GRAD = [];
    for (const row of rows.slice(0, 12)) {
      const tr = await fetchFn({ op: "thread", id: row.id });
      const acc = tr.thread && tr.thread.posts.find((p) => p.accepted);
      if (acc) GRAD.push({ slug: row.id, title: row.title, category: "community", tier: "community", keywords: row.tags || [], body: acc.body, sourceType: "discussion", deepLink: `#thread/${row.id}?post=${acc.id}` });
    }
  } catch { GRAD = []; } // store unreachable → Solutions still works from the KB alone
  return GRAD;
}
async function fetchFn(payload) {
  const res = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({ ok: false, error: "bad response" }));
  if (!res.ok && !data.errors) throw new Error(data.error || "store error");
  return data;
}

// ── views / router
const VIEWS = ["home", "solutions", "solution", "discussions", "thread", "askai", "experts", "trends"];
function show(view) {
  $$("main section[data-view]").forEach((s) => s.classList.toggle("on", s.dataset.view === view));
  $$("[data-nav]").forEach((a) => {
    const on = a.dataset.nav === view || (view === "solution" && a.dataset.nav === "solutions") || (view === "thread" && a.dataset.nav === "discussions");
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
}
function route() {
  const h = location.hash.replace(/^#/, "");
  const [pathPart, queryPart] = h.split("?");
  const q = new URLSearchParams(queryPart || "");
  const [name, ...rest] = pathPart.split("/");
  if (name === "solutions") { show("solutions"); const query = q.get("q") || ""; $("#solAskInput").value = query; if (query) runSearch(query); return; }
  if (name === "solution" && rest[0]) { show("solution"); renderSolution(decodeURIComponent(rest.join("/"))); return; }
  if (name === "discussions") { show("discussions"); renderThreadList(); return; }
  if (name === "thread" && rest[0]) { show("thread"); renderThread(decodeURIComponent(rest[0]), q.get("post")); return; }
  if (VIEWS.includes(name) && name) { show(name); return; }
  show("home");
}
window.addEventListener("hashchange", route);

// ── confidence row (REAL normalized score; raw always carried)
function confRow(conf) {
  const label = conf.band === "high" ? "High" : conf.band === "med" ? "Medium" : "Low";
  const cls = conf.band === "high" ? "conf-high" : conf.band === "med" ? "conf-med" : "conf-low-t";
  return `<div class="confrow"><span>Confidence</span><span class="meter ${conf.band}"><span style="width:${conf.value}%"></span></span>` +
    `<b class="${cls}">${label} · ${conf.value}</b><span class="muted">· ${conf.sources} source${conf.sources === 1 ? "" : "s"} · raw ${conf.raw}</span></div>`;
}

// ── Solutions search
let lastQuery = "";
async function runSearch(query) {
  lastQuery = query;
  const box = $("#solResults");
  box.innerHTML = `<div class="grid" style="gap:10px"><div class="sk" style="width:70%"></div><div class="sk"></div><div class="sk" style="width:85%"></div></div>`;
  let docs;
  try { docs = await loadKb(); } catch {
    box.innerHTML = `<div class="card"><span class="chip crit"><span class="led"></span>Couldn't reach the KB</span><p class="muted" style="font-size:13px">Check your connection, then retry. Nothing was lost.</p><button class="btn ghost" onclick="location.reload()">↻ Retry</button></div>`;
    return;
  }
  const grad = await loadGraduated();
  // Unchecking a listed category excludes it; docs in smaller, unlisted categories always stay in.
  const unchecked = $$("#catFilter input:not(:checked)").map((i) => i.value);
  const filtered = unchecked.length ? docs.filter((d) => !unchecked.includes(d.category)) : docs;
  const r = retrieve(query, filtered, { topK: 4, communityDocs: grad });
  if (query !== lastQuery) return;

  if (r.abstain) {
    box.innerHTML =
      `<div class="card" role="region" aria-label="No confident match">` +
      `<span class="meter low" style="display:block;max-width:160px;margin-bottom:10px"><span style="width:${r.confidence.value}%"></span></span>` +
      `<b>No confident match — we won't guess.</b>` +
      `<p class="muted" style="font-size:13.5px;line-height:1.55">Top retriever score ${r.confidence.raw} is below the abstain threshold (${ABSTAIN_THRESHOLD}). Ask the community or escalate to a human.</p>` +
      `<div class="rowbtn"><a class="btn ghost" href="#discussions">Ask the community</a><a class="btn gold" href="/#contact">Escalate to IIS</a></div></div>`;
    return;
  }

  const top = r.results[0];
  const aiCard =
    `<div class="ai-card" role="region" aria-label="AI answer">` +
    `<div class="ai-head"><div class="ai-orb" aria-hidden="true">✦</div><b>ARIA answer</b><span class="chip cyan" style="margin-left:auto">sourced · ${top.doc.sourceType === "discussion" ? "community" : "KB"}</span></div>` +
    `<div class="ai-body">${esc(summarize(top.doc))}</div>` + confRow(r.confidence) +
    `<div class="rowbtn"><a class="btn primary" href="${top.doc.sourceType === "discussion" ? top.doc.deepLink : `#solution/${encodeURIComponent(top.doc.slug)}`}">Open ${top.doc.sourceType === "discussion" ? "the discussion" : "solution"} →</a></div>` +
    `<div class="ai-honesty">AI-retrieved and sourced. Verify before acting on production systems.</div></div>`;

  const rows = r.results.map((res, i) => {
    const d = res.doc;
    const href = d.sourceType === "discussion" ? d.deepLink : `#solution/${encodeURIComponent(d.slug)}`;
    const badge = d.sourceType === "discussion"
      ? `<div style="margin-bottom:6px"><span class="chip gold"><span aria-hidden="true">↗</span> from a discussion</span></div>`
      : (i === 0 ? `<div style="display:flex;gap:9px;margin-bottom:7px"><span class="chip ok"><span class="led"></span>#1 · Verified KB</span></div>` : "");
    const meta = d.sourceType === "discussion" ? `<span>accepted answer</span><span>·</span><span>deep-links to the exact post ↵</span>` : `<span>${esc(d.category)}</span><span>·</span><span>${esc(d.tier || "kb")}</span><span>·</span><span>score ${res.score}</span>`;
    return `<div class="${i === 0 ? "rank1" : "result"}">${badge}<h3><a href="${href}">${esc(d.title)}</a></h3><p class="snip">${esc(summarize(d, 180))}</p><div class="rmeta">${meta}</div></div>`;
  }).join("");

  box.innerHTML = aiCard + `<h2 class="sec" style="margin-top:26px">${r.results.length} ranked result${r.results.length === 1 ? "" : "s"}</h2>` + rows;
}
const submitSearch = (q) => { if (q.trim()) location.hash = `solutions?q=${encodeURIComponent(q.trim())}`; };
$("#heroAsk").addEventListener("submit", (e) => { e.preventDefault(); submitSearch($("#heroAskInput").value); });
$("#solAsk").addEventListener("submit", (e) => { e.preventDefault(); submitSearch($("#solAskInput").value); });
$("#navSearch").addEventListener("submit", (e) => { e.preventDefault(); submitSearch($("#navSearchInput").value); });
$("#catFilter").addEventListener("change", () => { if (lastQuery) runSearch(lastQuery); });

// ── Solution page (rendered from the real chunk body)
async function renderSolution(slug) {
  const el = $("#solutionPage");
  el.innerHTML = `<div class="grid" style="gap:10px"><div class="sk" style="width:50%"></div><div class="sk"></div></div>`;
  let docs;
  try { docs = await loadKb(); } catch { el.innerHTML = `<div class="card"><span class="chip crit"><span class="led"></span>Couldn't reach the KB</span></div>`; return; }
  const d = docs.find((x) => x.slug === slug);
  if (!d) { el.innerHTML = `<div class="empty"><div class="em-ico" aria-hidden="true">⌕</div><h4>Solution not found</h4><p>This article isn't in the KB. Try a search instead.</p><a class="btn ghost" href="#solutions">Back to Solutions</a></div>`; return; }
  el.innerHTML =
    `<div class="crumb">Solutions / ${esc(d.category)} / <span class="muted">${esc(d.slug)}</span></div>` +
    `<article style="max-width:760px">` +
    `<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px"><span class="chip ok"><span class="led"></span>Verified KB</span><span class="chip">${esc(d.category)}</span>${d.tier ? `<span class="chip">${esc(d.tier)}</span>` : ""}</div>` +
    `<h1 style="font-size:clamp(26px,3vw,36px);font-weight:700;letter-spacing:-.025em;line-height:1.15;margin:0 0 12px">${esc(d.title)}</h1>` +
    `<div class="card" style="margin:18px 0"><div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">` +
    `<div class="ai-orb" aria-hidden="true" style="width:34px;height:34px">⚡</div>` +
    `<div style="flex:1;min-width:200px"><b>Fix this automatically</b><div class="muted" style="font-size:13px;margin-top:2px">ARIA Sentinel runs the verified recipe on your machine — you approve each step.</div></div>` +
    `<a class="btn primary" href="/aria">Open in ARIA →</a><a class="btn ghost" href="/downloads">Download Sentinel</a></div></div>` +
    `<div class="sol-body">${md(d.body)}</div>` +
    `<h2 class="sec">Still stuck? Show ARIA the error</h2>` +
    `<div class="dropzone" role="button" tabindex="0" aria-label="Drop a screenshot for visual diagnosis"><div class="di" aria-hidden="true">🖼</div><b>Drop a screenshot, log, or photo of the error</b><div class="muted" style="font-size:13px;margin-top:6px">Fable 5 visual diagnosis reads BSODs, dialogs, and config screens.</div><div class="chip gold" style="margin-top:12px"><span class="led"></span>Visual diagnosis coming online</div></div>` +
    `<div class="rowbtn" style="margin-top:18px"><a class="btn gold" href="/#contact">Escalate to IIS →</a><span class="muted" style="font-size:12.5px;align-self:center">Complex case? A human takes over.</span></div>` +
    `</article>`;
  wireDropzones(el);
}

// ── Discussions list
async function renderThreadList() {
  const box = $("#threadList");
  box.innerHTML = `<div class="grid" style="gap:10px"><div class="sk" style="width:70%"></div><div class="sk"></div></div>`;
  let data;
  try { data = await fetchFn({ op: "list" }); } catch {
    box.innerHTML = `<div class="card"><span class="chip crit"><span class="led"></span>Couldn't reach the discussion store</span><p class="muted" style="font-size:13px">Check your connection, then retry. Nothing was lost.</p><button class="btn ghost" id="tlRetry">↻ Retry</button></div>`;
    $("#tlRetry").onclick = renderThreadList;
    return;
  }
  const threads = data.threads || [];
  if (!threads.length) {
    box.innerHTML = `<div class="empty"><div class="em-ico" aria-hidden="true">💬</div><h4>No discussions yet — you could be first</h4><p>Ask anything IT. The community refines it, and accepted answers graduate into Solutions. No fake threads, ever.</p><button class="btn primary" id="emptyStart">＋ Start a discussion</button></div>`;
    $("#emptyStart").onclick = () => $("#newThreadBtn").click();
    return;
  }
  box.innerHTML = threads.map((t) =>
    `<div class="threadrow"><div><h4><a href="#thread/${encodeURIComponent(t.id)}">${t.title}</a></h4>` +
    `<div class="tmeta"><span>by ${esc(t.author)}</span><span>· ${t.replies === 0 ? "awaiting answer" : `${t.replies} repl${t.replies === 1 ? "y" : "ies"}`}</span></div>` +
    `<div class="tags">${(t.tags || []).map((x) => `<span class="tag">${x}</span>`).join("")}</div></div>` +
    `<div style="text-align:right">${t.accepted ? `<span class="chip gold"><span class="led"></span>Accepted</span>` : ""}</div></div>`
  ).join("");
}
$("#newThreadBtn").addEventListener("click", () => requireSignIn(() => { $("#composerWrap").hidden = false; $("#ctTitle").focus(); }));
$("#composerCancel").addEventListener("click", () => { $("#composerWrap").hidden = true; });
$("#threadComposer").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.setAttribute("aria-busy", "true");
  try {
    const r = await fetchFn({ op: "create", title: $("#ctTitle").value, body: $("#ctBody").value, tags: $("#ctTags").value.split(",").map((s) => s.trim()).filter(Boolean), email: getEmail() });
    if (!r.ok) { toast((r.errors || ["couldn't post"]).join("; "), "err"); return; }
    $("#composerWrap").hidden = true;
    e.target.reset();
    toast("Discussion posted.");
    location.hash = `thread/${encodeURIComponent(r.id)}`;
  } catch { toast("Couldn't reach the discussion store — nothing was lost, retry shortly.", "err"); }
  finally { btn.removeAttribute("aria-busy"); }
});

// ── Single thread (+ deep-link scroll & gold pulse)
async function renderThread(id, targetPost) {
  const el = $("#threadPage");
  el.innerHTML = `<div class="grid" style="gap:10px"><div class="sk" style="width:50%"></div><div class="sk"></div></div>`;
  let data;
  try { data = await fetchFn({ op: "thread", id }); } catch { el.innerHTML = `<div class="card"><span class="chip crit"><span class="led"></span>Couldn't reach the discussion store</span></div>`; return; }
  if (!data.ok || !data.thread) { el.innerHTML = `<div class="empty"><div class="em-ico" aria-hidden="true">💬</div><h4>Thread not found</h4><p>It may have been removed.</p><a class="btn ghost" href="#discussions">Back to Discussions</a></div>`; return; }
  const t = data.thread;
  const me = getEmail();
  const banner = targetPost ? `<div class="xlink-banner"><span aria-hidden="true">↗</span> You followed a <b>&nbsp;discussion-sourced&nbsp;</b> result from Solutions — jumping to the exact post.</div>` : "";
  const postHtml = (p) => {
    const inner =
      `<div class="post"><div class="vote">` +
      `<button aria-label="Upvote" data-vote="up" data-post="${p.id}">▲</button><span class="v">${p.votes}</span><button aria-label="Downvote" data-vote="down" data-post="${p.id}">▼</button></div>` +
      `<div><div class="who"><span class="avatar" aria-hidden="true">${esc((p.author || "?")[0].toUpperCase())}</span><b style="color:var(--txt)">${esc(p.author)}</b>` +
      `${p.isOP ? `<span class="muted">· original post</span>` : ""}</div>` +
      `<div class="body">${md(p.body)}</div>` +
      `${!p.accepted && !p.isOP && t.canAccept ? `<div class="rowbtn"><button class="btn ghost" data-accept="${p.id}" style="padding:7px 12px;font-size:12px">✓ Accept this answer</button></div>` : ""}` +
      `</div></div>`;
    return p.accepted
      ? `<div class="accepted${targetPost === p.id ? " target-post" : ""}" id="post-${p.id}"><div class="acc-tag"><span class="led"></span>Accepted answer${t.graduated ? " · graduated to Solutions ↗" : ""}</div>${inner}</div>`
      : `<div id="post-${p.id}"${targetPost === p.id ? ' class="target-post"' : ""}>${inner}</div>`;
  };
  t.canAccept = !!(me && t.posts[0] && t.posts[0].isOP && t.posts[0].author === me.split("@")[0]);
  el.innerHTML =
    banner +
    `<div class="crumb"><a href="#discussions">Discussions</a> / thread</div>` +
    `<h1 style="font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0 0 6px;max-width:760px">${t.title}</h1>` +
    `<div class="tags" style="margin-bottom:18px">${(t.tags || []).map((x) => `<span class="tag">${x}</span>`).join("")}</div>` +
    `<div style="max-width:760px">${t.posts.map(postHtml).join("")}` +
    `<form class="composer" id="replyForm" style="margin-top:20px"><label for="replyBody">Add a reply (markdown + code blocks supported)</label>` +
    `<textarea id="replyBody" required minlength="2" placeholder="Share what worked, exact commands help…"></textarea>` +
    `<div class="rowbtn"><button class="btn ghost" type="submit">＋ Add a reply</button></div></form></div>`;
  if (targetPost) {
    const target = $(`#post-${CSS.escape(targetPost)}`);
    if (target) setTimeout(() => target.scrollIntoView({ block: "center" }), 60);
  }
  $("#replyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    requireSignIn(async () => {
      try {
        const r = await fetchFn({ op: "reply", id, body: $("#replyBody").value, email: getEmail() });
        if (!r.ok) { toast((r.errors || ["couldn't reply"]).join("; "), "err"); return; }
        toast("Reply posted.");
        renderThread(id, null);
      } catch { toast("Couldn't reach the discussion store — retry shortly.", "err"); }
    });
  });
  el.addEventListener("click", (e) => {
    const vote = e.target.closest("[data-vote]");
    if (vote) return requireSignIn(async () => {
      try { const r = await fetchFn({ op: "vote", id, postId: vote.dataset.post, dir: vote.dataset.vote, email: getEmail() }); if (r.ok) renderThread(id, null); else toast((r.errors || []).join("; "), "err"); }
      catch { toast("Couldn't reach the discussion store.", "err"); }
    });
    const acc = e.target.closest("[data-accept]");
    if (acc) return requireSignIn(async () => {
      try { const r = await fetchFn({ op: "accept", id, postId: acc.dataset.accept, email: getEmail() }); if (r.ok) { GRAD = null; toast("Accepted — this answer graduates to Solutions ↗"); renderThread(id, null); } else toast((r.errors || []).join("; "), "err"); }
      catch { toast("Couldn't reach the discussion store.", "err"); }
    });
  }, { once: false });
}

// ── Ask AI (real KB baseline; drop-zone = honest coming-online; no fake thinking for absent features)
function aiBubble(html, who) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${who}`;
  wrap.innerHTML = `<div class="who-ico" aria-hidden="true">${who === "ai" ? "✦" : "A"}</div><div class="bubble">${html}</div>`;
  $("#aiLog").appendChild(wrap);
  wrap.scrollIntoView({ block: "end" });
  return wrap;
}
$("#aiAsk").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#aiAskInput").value.trim();
  if (!q) return;
  $("#aiAskInput").value = "";
  aiBubble(esc(q), "user");
  const thinking = aiBubble(`<div class="thinking"><span class="dots"><span></span><span></span><span></span></span> Searching the verified KB…</div>`, "ai");
  let docs;
  try { docs = await loadKb(); } catch { thinking.querySelector(".bubble").innerHTML = `<span class="chip crit"><span class="led"></span>Couldn't reach the KB</span> Check your connection and retry — nothing was lost.`; return; }
  const grad = await loadGraduated();
  const r = retrieve(q, docs, { topK: 1, communityDocs: grad });
  if (r.abstain) {
    thinking.querySelector(".bubble").innerHTML =
      `<b>No confident match — we won't guess.</b><div class="muted" style="font-size:13px;margin-top:6px">Top retriever score ${r.confidence.raw} (threshold ${ABSTAIN_THRESHOLD}).</div>` +
      `<div class="rowbtn"><a class="btn ghost" href="#discussions">Open a discussion</a><a class="btn gold" href="/#contact">Escalate to IIS</a></div>`;
    return;
  }
  const d = r.results[0].doc;
  thinking.querySelector(".bubble").innerHTML =
    `<b>${esc(d.title)}</b><div style="margin-top:8px">${esc(summarize(d))}</div>` + confRow(r.confidence) +
    `<div class="rowbtn"><a class="btn primary" href="${d.sourceType === "discussion" ? d.deepLink : `#solution/${encodeURIComponent(d.slug)}`}">Open the full ${d.sourceType === "discussion" ? "discussion" : "solution"} →</a><a class="btn ghost" href="#discussions">Ask the community instead</a></div>` +
    `<div class="ai-honesty">AI-retrieved and sourced from the verified KB. Verify before acting on production systems.</div>`;
});

// Drop-zone: honest MVP — the Stage-2 vision engine isn't wired yet, and we say so plainly.
function wireDropzones(root) {
  $$(".dropzone", root || document).forEach((dz) => {
    if (dz._wired) return; dz._wired = true;
    const state = () => {
      const inAsk = !!dz.closest("[data-view='askai']");
      const msg = `<b>Visual diagnosis is coming online.</b><div class="muted" style="font-size:13px;margin-top:6px">The Fable 5 vision engine isn't wired into Forums yet — we won't pretend to read your screenshot. Describe the problem in text and the real KB answers now, or open a discussion and attach details there.</div>`;
      if (inAsk) aiBubble(msg, "ai"); else toast("Visual diagnosis is coming online — describe the problem in text for a real KB answer now.");
    };
    ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("dragover"); if (ev === "drop") state(); }));
    dz.addEventListener("click", state);
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); state(); } });
  });
}

// ── boot
paintSession();
wireDropzones(document);
loadKb().catch(() => { $("#kbCount").textContent = "--"; });
route();
