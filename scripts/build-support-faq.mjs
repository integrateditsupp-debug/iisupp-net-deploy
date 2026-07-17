#!/usr/bin/env node
// build-support-faq.mjs — generate the PUBLIC "Technical Support · FAQ" from the REAL KB.
// -----------------------------------------------------------------------------------------------
// Single source of truth = assets/aria-kb-chunks.json (the same corpus that powers the /aria chat and
// the forums). Every FAQ entry is SHAPED end-user-safe (shapeKbAnswerForEndUser): it LEADS with the
// plain-language explanation + the numbered fix steps and NEVER emits Internal Technician Notes /
// registry / keyword-tag sections (P0). Nothing is invented (Rule 14) — an article with no real fix
// steps is skipped, not padded. Re-run any time the KB changes: `node scripts/build-support-faq.mjs`.
//
// Emits:
//   assets/support-faq.json               — category-grouped entry data (also embedded in the page)
//   assets/support-faq-screenshots.json   — admin-fillable manifest (real-or-empty; never overwritten)
//   support-faq.html                       — the crawlable public page (index,follow + FAQPage JSON-LD)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { shapeKbAnswerForEndUser, isEndUserSafe } from "../assets/kb-answer-shape.mjs";
import { parseFrontmatter } from "../assets/forums-retriever.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => readFileSync(path.join(ROOT, p), "utf8");

// ---- category taxonomy (end-user buckets; priority order — first match wins) -------------------
const CATS = [
  { key: "printing", label: "Printing", re: /print/ },
  { key: "vpn_remote", label: "VPN & Remote Desktop", re: /\bvpn\b|anyconnect|globalprotect|remote[\s-]?desktop|\brdp\b|fortinet|ivanti|pulse[\s-]?secure/ },
  { key: "teams_zoom", label: "Teams & Zoom", re: /teams|zoom/ },
  { key: "onedrive_sharepoint", label: "OneDrive & SharePoint", re: /onedrive|one[\s-]?drive|sharepoint/ },
  { key: "email_outlook", label: "Email & Outlook", re: /outlook|inbox|\bemail\b|\bmail\b|exchange|smtp|signature|outbox/ },
  { key: "m365_office", label: "Microsoft 365 & Office", re: /m365|\b365\b|office|word|excel|powerpoint|onenote|activation|licens/ },
  { key: "accounts_mfa", label: "Accounts, Sign-in & MFA", re: /password|\bmfa\b|authenticat|sign[\s-]?in|account.?lock|locked.?out|\bsspr\b|smart[\s-]?card|\bsso\b|\bsaml\b|azure[\s-]?ad|active[\s-]?directory|bitlocker|identity/ },
  { key: "security", label: "Security (phishing, malware, scams)", re: /phishing|scam|malware|virus|ransomware|\bbreach\b|suspicious|\bsecurity\b/ },
  { key: "wifi_network", label: "Wi-Fi & Network", re: /wi[\s-]?fi|wireless|\bnetwork\b|\bdns\b|dhcp|internet|ethernet|mapped[\s-]?drive|gateway/ },
  { key: "display_hardware", label: "Display & Hardware", re: /display|monitor|screen|webcam|camera|\busb\b|bluetooth|audio|\bsound\b|speaker|headset|keyboard|mouse|battery|\bpower\b|scanner|hardware/ },
  { key: "windows", label: "Windows (update, boot, performance)", re: /windows[\s-]?update|\bupdate\b|bsod|blue[\s-]?screen|\bboot\b|\bslow\b|sluggish|performance|disk[\s-]?full|low[\s-]?disk|black[\s-]?screen|freeze|crash/ },
  { key: "other", label: "More common fixes", re: /.*/ }
];
function categorize(hay) { for (const c of CATS) if (c.re.test(hay)) return c; return CATS[CATS.length - 1]; }

// ---- extract the public-safe pieces from a SHAPED answer ---------------------------------------
const MARKERS = ["**What to do**", "**Confirm it's fixed**", "**If that doesn't resolve it**", "**Prevent it next time**"];
function firstMarker(text) { let cut = -1; for (const m of MARKERS) { const i = text.indexOf(m); if (i >= 0 && (cut < 0 || i < cut)) cut = i; } return cut; }
function section(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const after = start + marker.length;
  let end = text.length;
  for (const m of MARKERS) { if (m === marker) continue; const i = text.indexOf(m, after); if (i >= 0 && i < end) end = i; }
  return text.slice(after, end).trim();
}
function parseShaped(shaped) {
  let t = String(shaped || "");
  t = t.replace(/^#\s+.*\n?/, "").trim(); // drop the "# Title" line
  const mk = firstMarker(t);
  const explanation = (mk < 0 ? t : t.slice(0, mk)).trim().replace(/^["']|["']$/g, "");
  const steps = section(t, "**What to do**");
  const verify = section(t, "**Confirm it's fixed**");
  const escalate = section(t, "**If that doesn't resolve it**");
  const prevent = section(t, "**Prevent it next time**");
  return { explanation, steps, verify, escalate, prevent };
}

// ---- tiny, safe markdown → HTML (numbered/bulleted steps, **bold**, `code`, → breadcrumbs) ------
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?:&rarr;|-&gt;|→)/g, "&rarr;");
}
function mdToHtml(md) {
  const lines = String(md || "").split(/\r?\n/);
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ol) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(ol[1])}</li>`; }
    else if (ul) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(ul[1])}</li>`; }
    else if (!line.trim()) { close(); }
    else { close(); const h = line.match(/^\*\*(.+)\*\*$/); html += h ? `<p class="faq-sub">${inline(h[1])}</p>` : `<p>${inline(line)}</p>`; }
  }
  close();
  return html;
}
const plain = (md) => String(md || "").replace(/[`*#>]/g, "").replace(/\s+/g, " ").trim();

// ---- build entries -----------------------------------------------------------------------------
const kb = JSON.parse(rd("assets/aria-kb-chunks.json"));
const chunks = kb.chunks || (Array.isArray(kb) ? kb : []);
const byCat = new Map(CATS.map((c) => [c.key, []]));
const seen = new Set();
let skippedNoSteps = 0, skippedUnsafe = 0, skippedDupe = 0;

for (const c of chunks) {
  const fm = parseFrontmatter(c.content);
  const tier = String(c.tier || fm.support_level || "").toLowerCase();
  const audience = String(fm.audience || "").toLowerCase();
  // End-user troubleshooting only: skip learned/advisory/vertical-compliance chunks + technician-only.
  if (c._live || c.vertical === "learned") continue;
  if (audience && !/end.?user|employee|user/.test(audience)) { /* keep — most are end-user; only skip explicit non-user */ }
  const title = String(c.title || fm.title || c.slug || "").replace(/^["']|["']$/g, "").trim();
  if (!title || seen.has(title.toLowerCase())) { if (title) skippedDupe++; continue; }

  const shaped = shapeKbAnswerForEndUser(c.content || "");
  const parsed = parseShaped(shaped);
  // Actionable FAQ = must carry real fix steps. No steps → it is advisory, not a how-to → skip (Rule 14).
  if (!parsed.steps || parsed.steps.length < 8) { skippedNoSteps++; continue; }

  const escalation = (fm.escalation_trigger && String(fm.escalation_trigger).replace(/^["']|["']$/g, "").trim()) || plain(parsed.escalate).slice(0, 300);
  const entry = {
    id: c.slug,
    slug: c.slug,
    question: title,
    explanation: parsed.explanation,
    stepsMd: parsed.steps,
    verifyMd: parsed.verify,
    preventMd: parsed.prevent,
    escalation,
    url: `https://iisupp.net/aria?article=${encodeURIComponent(c.slug)}`,
    screenshot: null
  };
  // Defense in depth — nothing internal ever ships.
  const blob = [entry.question, entry.explanation, entry.stepsMd, entry.verifyMd, entry.preventMd, entry.escalation].join("\n");
  if (!isEndUserSafe(blob)) { skippedUnsafe++; continue; }

  const cat = categorize(`${c.slug} ${title} ${fm.category || c.vertical || ""} ${(c.keywords || []).join(" ")}`.toLowerCase());
  byCat.get(cat.key).push(entry);
  seen.add(title.toLowerCase());
}

const categories = CATS
  .map((c) => ({ key: c.key, label: c.label, entries: byCat.get(c.key).sort((a, b) => a.question.localeCompare(b.question)) }))
  .filter((c) => c.entries.length);
const total = categories.reduce((n, c) => n + c.entries.length, 0);

// ---- write the data file -----------------------------------------------------------------------
const data = { generated_at: new Date().toISOString(), source: "assets/aria-kb-chunks.json", kb_generated_at: kb.generated_at || null, count: total, categories };
writeFileSync(path.join(ROOT, "assets/support-faq.json"), JSON.stringify(data, null, 2));

// ---- screenshot manifest (real-or-empty; NEVER overwrite admin-filled captures) ----------------
const shotPath = path.join(ROOT, "assets/support-faq-screenshots.json");
let shots = { note: "Admin-fillable. Map an entry slug -> an array of REAL screenshot paths under /images/faq/. Empty array = text-only (honest; a step never shows a fabricated screenshot). Populate over time; the page degrades cleanly.", shots: {} };
if (existsSync(shotPath)) { try { shots = JSON.parse(readFileSync(shotPath, "utf8")); } catch { /* rebuild */ } }
for (const c of categories) for (const e of c.entries) if (!(e.slug in shots.shots)) shots.shots[e.slug] = [];
writeFileSync(shotPath, JSON.stringify(shots, null, 2));

// ---- FAQPage JSON-LD ---------------------------------------------------------------------------
const jsonld = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://iisupp.net/support-faq#faq",
  mainEntity: categories.flatMap((c) => c.entries.map((e) => ({
    "@type": "Question",
    name: e.question,
    acceptedAnswer: { "@type": "Answer", text: [e.explanation, plain(e.stepsMd)].filter(Boolean).join(" ").slice(0, 900) }
  })))
};

// ---- render entries + category HTML (all content in the DOM → crawlable) ------------------------
function entryHtml(e) {
  const searchBlob = esc([e.question, e.explanation, plain(e.stepsMd)].join(" ").toLowerCase());
  const shot = "";
  return `<details class="faq-item" data-search="${searchBlob}">
  <summary><span class="faq-q">${esc(e.question)}</span><span class="faq-chev" aria-hidden="true">+</span></summary>
  <div class="faq-a">
    ${e.explanation ? `<p class="faq-explain">${inline(e.explanation)}</p>` : ""}
    <div class="faq-steps"><p class="faq-sub">What to do</p>${mdToHtml(e.stepsMd)}</div>
    ${e.verifyMd ? `<div class="faq-more"><p class="faq-sub">Confirm it's fixed</p>${mdToHtml(e.verifyMd)}</div>` : ""}
    ${e.escalation ? `<p class="faq-escalate"><strong>Still stuck?</strong> ${inline(e.escalation)}</p>` : ""}
    <div class="faq-cta">
      <a class="faq-btn" href="/aria?mode=walkthrough&amp;article=${encodeURIComponent(e.slug)}">Open ARIA for a guided walk-through</a>
      <a class="faq-link" href="/forums/">Ask the community</a>
    </div>${shot}
  </div>
</details>`;
}
const catNav = categories.map((c) => `<button class="faq-cat" data-cat="${c.key}">${esc(c.label)} <span class="faq-count">${c.entries.length}</span></button>`).join("");
const catSections = categories.map((c) =>
  `<section class="faq-section" data-cat="${c.key}" id="cat-${c.key}">
    <h2>${esc(c.label)}</h2>
    ${c.entries.map(entryHtml).join("\n")}
  </section>`).join("\n");

// ---- proof footer (public-page pattern) --------------------------------------------------------
const proofFooter = `<section class="cw-proof-links" aria-label="Proof and free tools">
  <div class="cw-proof-h">Proof &amp; free tools</div>
  <div class="cw-proof-row">
    <a href="/aria-benchmark.html">ARIA auto-resolve benchmark</a><span>·</span>
    <a href="/managed-it-cost-toronto.html">What managed IT actually costs</a><span>·</span>
    <a href="/copilot-oversharing-check.html">Copilot oversharing check</a><span>·</span>
    <a href="/switching-it-provider-checklist.html">Switching IT provider checklist</a>
  </div>
</section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index, follow, max-image-preview:standard">
<title>Technical Support FAQ — fix common IT issues | Integrated IT Support</title>
<meta name="description" content="Step-by-step fixes for the most common IT issues — printing, Outlook, Wi-Fi, Microsoft 365, OneDrive, Teams, accounts &amp; MFA, security and more. Sourced from the real IIS knowledge base. Free to use.">
<link rel="canonical" href="https://iisupp.net/support-faq">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="Technical Support FAQ — Integrated IT Support">
<meta property="og:description" content="Clear, step-by-step fixes for common IT issues. Free self-serve help from the real IIS knowledge base.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://iisupp.net/support-faq">
<script type="application/ld+json">
${JSON.stringify(jsonld)}
</script>
<style>
  :root{--bg:#000;--ink:#f4efe4;--ink2:#b9b1a1;--gold:#c5a059;--gold2:#f1dca7;--line:rgba(197,160,89,.22);--surface:#0c0c0e;--surface2:#111114}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6}
  a{color:var(--gold2);text-decoration:none}
  .wrap{max-width:1000px;margin:0 auto;padding:0 20px}
  header.site{position:sticky;top:0;z-index:20;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
  header.site .wrap{display:flex;align-items:center;gap:18px;height:60px}
  header.site .brand{font-weight:800;letter-spacing:-.01em;color:var(--ink)}
  header.site nav{display:flex;gap:16px;flex-wrap:wrap;margin-left:auto;font-size:14px}
  header.site nav a{color:var(--ink2)}
  header.site nav a:hover{color:var(--gold2)}
  .hero{padding:54px 0 20px;text-align:center;border-bottom:1px solid var(--line)}
  .eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
  .hero h1{font-size:38px;line-height:1.12;margin:0 0 12px;letter-spacing:-.02em}
  .hero p{color:var(--ink2);max-width:640px;margin:0 auto;font-size:16px}
  .tools{position:sticky;top:60px;z-index:15;background:rgba(0,0,0,.9);border-bottom:1px solid var(--line);padding:14px 0}
  .search{display:flex;align-items:center;gap:10px;max-width:560px;margin:0 auto 12px;border:1px solid var(--line);border-radius:12px;padding:11px 14px;background:var(--surface)}
  .search input{flex:1;background:transparent;border:0;outline:0;color:var(--ink);font-size:15px}
  .cats{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
  .faq-cat{cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--ink2);border-radius:20px;padding:6px 13px;font-size:13px}
  .faq-cat.on{background:var(--gold);border-color:var(--gold);color:#1a1206;font-weight:600}
  .faq-count{opacity:.6;font-size:11px}
  main{padding:26px 0 40px}
  .faq-section{margin:0 0 30px}
  .faq-section h2{font-size:20px;color:var(--gold2);border-bottom:1px solid var(--line);padding-bottom:8px;margin:24px 0 14px}
  .faq-item{border:1px solid var(--line);border-radius:12px;margin:0 0 10px;background:var(--surface);overflow:hidden}
  .faq-item[open]{background:var(--surface2)}
  .faq-item summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:15px 17px;font-weight:600;font-size:16px}
  .faq-item summary::-webkit-details-marker{display:none}
  .faq-q{flex:1}
  .faq-chev{color:var(--gold);font-size:20px;line-height:1}
  .faq-item[open] .faq-chev{transform:rotate(45deg)}
  .faq-a{padding:2px 18px 18px;color:var(--ink);border-top:1px solid var(--line)}
  .faq-explain{color:var(--ink2);font-style:italic;margin:12px 0}
  .faq-sub{font-weight:700;color:var(--gold);margin:16px 0 6px;font-size:13px;letter-spacing:.04em;text-transform:uppercase}
  .faq-a ol,.faq-a ul{margin:6px 0;padding-left:22px}
  .faq-a li{margin:5px 0}
  .faq-a code{background:rgba(197,160,89,.12);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:var(--gold2)}
  .faq-escalate{margin:16px 0 4px;padding:12px 14px;border-left:3px solid var(--gold);background:rgba(197,160,89,.06);border-radius:0 8px 8px 0;color:var(--ink2)}
  .faq-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
  .faq-btn{background:var(--gold);color:#1a1206;font-weight:600;border-radius:9px;padding:9px 15px;font-size:14px}
  .faq-link{border:1px solid var(--line);border-radius:9px;padding:9px 15px;font-size:14px;color:var(--ink2)}
  .faq-empty{display:none;text-align:center;color:var(--ink2);padding:40px 0}
  footer.site{border-top:1px solid var(--line);padding:30px 0;color:var(--ink2);font-size:14px;text-align:center}
  footer.site a{color:var(--ink2);margin:0 8px}
  .cw-proof-links{max-width:1000px;margin:36px auto 8px;padding:0 20px;text-align:center}
  .cw-proof-h{font-size:12px;letter-spacing:.09em;text-transform:uppercase;opacity:.62;margin-bottom:10px}
  .cw-proof-row{font-size:15px;line-height:2}
  .cw-proof-row a{color:var(--gold);border-bottom:1px solid var(--line)}
  .cw-proof-row span{opacity:.35;padding:0 8px}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
  @media (max-width:640px){.hero h1{font-size:29px}}
</style>
</head>
<body>
<header class="site">
  <div class="wrap">
    <a class="brand" href="/">Integrated IT Support</a>
    <nav aria-label="Primary">
      <a href="/services.html">Services</a>
      <a href="/plans/">Plans</a>
      <a href="/aria">ARIA</a>
      <a href="/forums/">Forums</a>
      <a href="/support-faq.html" aria-current="page">Support FAQ</a>
      <a href="/start-here.html">Contact</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <div class="eyebrow">Technical Support · FAQ</div>
    <h1>Fix common IT issues, step by step</h1>
    <p>Clear, tested fixes for the problems people hit most — printing, Outlook, Wi-Fi, Microsoft&nbsp;365, OneDrive, Teams, accounts &amp; MFA, security and more. Sourced from the real IIS knowledge base. Free to use.</p>
  </div>
</section>

<div class="tools">
  <div class="wrap">
    <form class="search" role="search" onsubmit="return false">
      <span aria-hidden="true">&#9906;</span>
      <input id="faqSearch" type="search" placeholder="Search the FAQ — e.g. printer offline, Outlook won't open…" aria-label="Search the FAQ">
    </form>
    <div class="cats" role="tablist" aria-label="Categories">
      <button class="faq-cat on" data-cat="all">All <span class="faq-count">${total}</span></button>
      ${catNav}
    </div>
  </div>
</div>

<main>
  <div class="wrap">
    ${catSections}
    <div class="faq-empty" id="faqEmpty">No matching answers. Try fewer words, or <a href="/aria">ask ARIA directly</a>.</div>
  </div>
</main>

${proofFooter}
<footer class="site">
  <div class="wrap">
    <div><a href="/">Home</a> · <a href="/services.html">Services</a> · <a href="/aria">ARIA</a> · <a href="/forums/">Forums</a> · <a href="/start-here.html">Contact IIS</a></div>
    <p style="opacity:.6;margin-top:10px">Answers are sourced from the Integrated IT Support knowledge base. This is guidance — for changes on your device, open ARIA or contact IIS.</p>
  </div>
</footer>

<script>
(function(){
  var q=document.getElementById('faqSearch'),cats=document.querySelectorAll('.faq-cat'),
      items=document.querySelectorAll('.faq-item'),sections=document.querySelectorAll('.faq-section'),
      empty=document.getElementById('faqEmpty'),active='all';
  function apply(){
    var term=(q.value||'').trim().toLowerCase(),shown=0;
    items.forEach(function(it){
      var sec=it.closest('.faq-section'),cat=sec?sec.getAttribute('data-cat'):'';
      var okCat=active==='all'||cat===active;
      var okTerm=!term||(it.getAttribute('data-search')||'').indexOf(term)>=0;
      var vis=okCat&&okTerm; it.style.display=vis?'':'none'; if(vis)shown++;
    });
    sections.forEach(function(sec){
      var any=Array.prototype.some.call(sec.querySelectorAll('.faq-item'),function(i){return i.style.display!=='none';});
      sec.style.display=any?'':'none';
    });
    empty.style.display=shown?'none':'block';
  }
  cats.forEach(function(b){b.addEventListener('click',function(){cats.forEach(function(x){x.classList.remove('on');});b.classList.add('on');active=b.getAttribute('data-cat');apply();});});
  q.addEventListener('input',apply);
})();
</script>
</body>
</html>
`;
writeFileSync(path.join(ROOT, "support-faq.html"), html);

console.log(`support-faq: ${total} entries across ${categories.length} categories`);
console.log(`  ${categories.map((c) => `${c.key}:${c.entries.length}`).join("  ")}`);
console.log(`  skipped — no-steps:${skippedNoSteps} unsafe:${skippedUnsafe} dupe-title:${skippedDupe}`);
console.log(`  wrote assets/support-faq.json · assets/support-faq-screenshots.json · support-faq.html`);
