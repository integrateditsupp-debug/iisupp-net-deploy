import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { publishAgentReport } from "./autonomy-supervisor-core.mjs";

const root = process.cwd();
const engineDir = path.join(root, "senior-director-state", "opportunity-engine");
const sourcesPath = path.join(engineDir, "sources.json");
const dbPath = path.join(engineDir, "opportunities.json");
const logPath = path.join(engineDir, "actions-log.json");

const nowIso = () => new Date().toISOString();

function normalizeText(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(parts) {
  return parts
    .join("|")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
}

function looksRelevantTender(text) {
  return /(information technology|it services|software|cyber|security|cloud|artificial intelligence|\bai\b|automation|microsoft|m365|system|systems|data|network|support|help desk|managed service|digital|web|website|application|learning management system|\blms\b|database|informatics|telecom|technical analyst|business analyst|project manager)/i.test(
    text
  );
}

function looksRelevantJob(text) {
  if (/(tutor|tutoring|lessons|teacher|instructor|payroll|bookkeeper|improver|driver|warehouse)/i.test(text)) {
    return false;
  }
  return /(ai|artificial intelligence|machine learning|ml engineer|automation|software|developer|engineer|architect|devops|sysadmin|systems administrator|cloud|azure|aws|cyber|security|data|analytics|m365|microsoft 365|it support|help desk|technical support|technical analyst|business analyst|product manager|project manager|solutions consultant|implementation consultant)/i.test(
    text
  );
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "IIS Opportunity Research Agent/1.0 (+https://iisupp.net; public allowed sources only)",
        accept: "text/html,application/rss+xml,application/xml,application/json;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function parseRss(xml, source) {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return itemMatches.slice(0, 25).map((match) => {
    const block = match[0];
    const title = normalizeText(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const link = normalizeText(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || source.url);
    const description = normalizeText(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || ""
    );
    const pubDate = normalizeText(block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || "");
    return buildOpportunity({
      source,
      title,
      link,
      description,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null
    });
  });
}

function parseHtmlLinks(html, source) {
  if (source.url.includes("canadabuys.canada.ca")) return parseCanadaBuys(html, source);
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const rows = [];
  for (const match of anchors) {
    const link = absoluteUrl(match[1], source.url);
    const title = normalizeText(match[2]);
    if (title.length < 12 || title.length > 180) continue;
    if (isNavigationTitle(title, link)) continue;
    if (!looksRelevant(`${title} ${link}`)) continue;
    const id = `${title}|${link}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(
      buildOpportunity({
        source,
        title,
        link,
        description: `Found on ${source.name}. Review source page for full details.`
      })
    );
    if (rows.length >= 25) break;
  }
  return rows;
}

function isNavigationTitle(title, link = "") {
  const normalized = title.toLowerCase();
  return [
    "skip to",
    "immigration and citizenship",
    "national security and defence",
    "about canada.ca",
    "terms and conditions",
    "privacy",
    "contact us",
    "view helpful search tips",
    "tender notices",
    "award notices",
    "procurement and contracting datasets",
    "official supplier contract history letter"
  ].some((bad) => normalized.includes(bad)) || /#wb-|#wb-|#t$|#a$/.test(link);
}

function parseCanadaBuys(html, source) {
  const rowMatches = [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)];
  const rows = [];
  for (const match of rowMatches) {
    const row = match[0];
    const titleMatch = row.match(/headers="view-dummy-notice-title[^"]*"[\s\S]*?<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const title = normalizeText(titleMatch[2]);
    if (!title || isNavigationTitle(title)) continue;
    const link = absoluteUrl(titleMatch[1], source.url);
    if (!link.includes("/tender-notice/")) continue;
    const org = normalizeText(
      row.match(/headers="view-field-tender-organization[^"]*"[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1] || source.name
    );
    const deadline = normalizeText(
      row.match(/headers="view-field-tender-closing-date[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || ""
    ).match(/\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2}/)?.[0] || null;
    const published = normalizeText(
      row.match(/headers="view-pub-ifnot-amended[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || ""
    ).match(/\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2}/)?.[0] || null;
    const category = normalizeText(
      row.match(/headers="view-field-term-label-1-1[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || ""
    );
    if (!looksRelevantTender(`${title} ${org} ${category}`)) continue;
    rows.push(
      buildOpportunity({
        source,
        title,
        organization: org,
        link,
        description: `CanadaBuys notice. Category: ${category || "not listed"}. Closing date: ${deadline || "not found"}.`,
        publishedAt: published ? new Date(published.replace(/\//g, "-")).toISOString() : null,
        deadline
      })
    );
    if (rows.length >= 30) break;
  }
  return rows;
}

function parseRemoteOk(json, source) {
  const rows = JSON.parse(json);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.position)
    .filter((row) => looksRelevantJob(`${row.position || ""} ${(row.tags || []).join(" ")}`))
    .slice(0, 40)
    .map((row) =>
      buildOpportunity({
        source,
        title: row.position,
        organization: row.company || "RemoteOK company",
        link: row.url || source.url,
        description: [row.description, row.tags?.join(", ")].filter(Boolean).join(" "),
        location: row.location || "Remote",
        salary: row.salary_min || row.salary_max ? `$${row.salary_min || "?"}-$${row.salary_max || "?"}` : "",
        remoteStatus: "Remote",
        publishedAt: row.date || null
      })
    );
}

function parseRemotive(json, source) {
  const payload = JSON.parse(json);
  return (payload.jobs || [])
    .filter((row) => looksRelevantJob(`${row.title || ""} ${row.category || ""}`))
    .slice(0, 40)
    .map((row) =>
    buildOpportunity({
      source,
      title: row.title,
      organization: row.company_name || "Remotive company",
      link: row.url || source.url,
      description: row.description || "",
      location: row.candidate_required_location || "Remote",
      salary: row.salary || "",
      remoteStatus: "Remote",
      publishedAt: row.publication_date || null
    })
  );
}

function manualOpportunity(source) {
  const manual = source.manualOpportunity || {};
  const type = source.type || "lead";
  const defaultTitle =
    manual.title ||
    (type === "vendor registration" ? `${source.name} registration review` : source.name);
  const defaultOrganization =
    manual.organization ||
    (type === "vendor registration"
      ? source.name.replace(/\s+(supplier|vendor|procurement).*/i, "")
      : source.name);
  const defaultDescription =
    manual.description ||
    (type === "vendor registration"
      ? "Manual vendor portal opportunity. Review requirements, prepare company profile, and stop before account creation or legal certification."
      : "Manual opportunity added from verified internal lead review. Confirm requirements, prepare a truthful packet, and stop before submit or any legal commitment.");
  const defaultNextStep =
    manual.recommendedNextStep ||
    (type === "vendor registration"
      ? "Review portal and prepare registration checklist for Ahmad approval."
      : "Review the official source, prepare a go/no-go brief, and stop before Submit/Send.");
  return buildOpportunity({
    source,
    title: defaultTitle,
    organization: defaultOrganization,
    link: manual.link || source.url,
    description: defaultDescription,
    recommendedNextStep: defaultNextStep,
    deadline: manual.deadline || null,
    salary: manual.salary || "",
    location: manual.location || null,
    remoteStatus: manual.remoteStatus || null,
    publishedAt: manual.publishedAt || null
  });
}

function looksRelevant(text) {
  const haystack = text.toLowerCase();
  return [
    "ai",
    "artificial intelligence",
    "automation",
    "it",
    "information technology",
    "cyber",
    "security",
    "software",
    "support",
    "managed service",
    "help desk",
    "cloud",
    "m365",
    "microsoft",
    "vendor",
    "supplier",
    "procurement",
    "remote",
    "developer",
    "engineer",
    "analyst",
    "consultant",
    "systems"
  ].some((needle) => haystack.includes(needle));
}

function estimatePotential(text, type) {
  const haystack = text.toLowerCase();
  let score = type === "tender" || type === "vendor registration" ? 7 : 5;
  if (/(bank|government|ministry|hospital|university|enterprise|municipal|crown)/i.test(haystack)) score += 2;
  if (/(ai|automation|cyber|security|managed service|support|m365|cloud)/i.test(haystack)) score += 1;
  if (/(senior|principal|lead|architect|director|consultant|contract)/i.test(haystack)) score += 1;
  return Math.min(10, score);
}

function estimateDifficulty(text, type) {
  const haystack = text.toLowerCase();
  let score = type === "job" ? 4 : type === "lead" ? 5 : 6;
  if (/(bond|insurance|rfp|standing offer|mandatory|clearance|security screening|certification)/i.test(haystack)) score += 2;
  if (/(bank|government|hospital|university)/i.test(haystack)) score += 1;
  if (/(easy apply|remote|quick apply)/i.test(haystack)) score -= 1;
  return Math.max(1, Math.min(10, score));
}

function priorityScore(potential, difficulty, sourcePriority) {
  return Math.max(1, Math.min(10, Math.round((potential * 1.4 + sourcePriority - difficulty * 0.45) / 2)));
}

function buildOpportunity(input) {
  const source = input.source;
  const title = normalizeText(input.title || source.name);
  const organization = normalizeText(input.organization || source.name);
  const link = input.link || source.url;
  const description = normalizeText(input.description || "");
  const type = source.type || "lead";
  const text = `${title} ${organization} ${description} ${(source.tags || []).join(" ")}`;
  const revenueOrGrowthPotential = estimatePotential(text, type);
  const difficultyScore = estimateDifficulty(text, type);
  const priority = priorityScore(revenueOrGrowthPotential, difficultyScore, source.priority || 5);
  const recommendedNextStep =
    input.recommendedNextStep ||
    (type === "job"
      ? "Review fit, prepare resume/application answers, and stop before Apply/Submit."
      : type === "vendor registration"
        ? "Prepare registration checklist and stop before account creation/certification."
        : "Open source, confirm requirements, prepare summary/pitch, and stop before Submit/Send.");

  return {
    id: makeId([title, link]),
    title,
    organization,
    sourceName: source.name,
    sourceId: source.id,
    sourceLink: link,
    type,
    deadline: input.deadline || null,
    estimatedValueOrSalary: input.salary || null,
    locationOrRemote: input.location || input.remoteStatus || null,
    contactDetails: null,
    whyRelevant: makeWhyRelevant(text, type),
    recommendedNextStep,
    priorityScore: priority,
    difficultyScore,
    revenueOrGrowthPotential,
    status: "new",
    tags: source.tags || [],
    summary: description.slice(0, 600),
    draftMessage: "",
    requiredDocuments: [],
    missingInformation: [],
    nextReminderAt: null,
    firstSeenAt: nowIso(),
    lastSeenAt: nowIso(),
    publishedAt: input.publishedAt || null
  };
}

function makeWhyRelevant(text, type) {
  const haystack = text.toLowerCase();
  const reasons = [];
  if (type === "tender") reasons.push("public-sector credibility and contract potential");
  if (type === "vendor registration") reasons.push("enterprise/vendor access path");
  if (type === "job") reasons.push("personal career growth and income potential");
  if (haystack.includes("ai") || haystack.includes("automation")) reasons.push("AI automation fit");
  if (haystack.includes("support") || haystack.includes("help desk")) reasons.push("IT support fit");
  if (haystack.includes("cyber") || haystack.includes("security")) reasons.push("cybersecurity fit");
  if (haystack.includes("remote")) reasons.push("remote-friendly");
  return reasons.length ? reasons.join(", ") : "possible business or career growth fit";
}

function mergeItems(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    const prior = map.get(item.id);
    if (prior) {
      map.set(item.id, {
        ...prior,
        ...item,
        status: prior.status || item.status,
        firstSeenAt: prior.firstSeenAt || item.firstSeenAt,
        draftMessage: prior.draftMessage || item.draftMessage,
        requiredDocuments: prior.requiredDocuments?.length ? prior.requiredDocuments : item.requiredDocuments,
        missingInformation: prior.missingInformation?.length ? prior.missingInformation : item.missingInformation,
        nextReminderAt: prior.nextReminderAt || item.nextReminderAt,
        lastSeenAt: nowIso()
      });
    } else {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return String(b.lastSeenAt).localeCompare(String(a.lastSeenAt));
  });
}

async function scanSource(source) {
  if (source.mode === "manual") return [manualOpportunity(source)];
  const body = await fetchText(source.url);
  if (source.mode === "rss") return parseRss(body, source);
  if (source.mode === "remoteok") return parseRemoteOk(body, source);
  if (source.mode === "remotive") return parseRemotive(body, source);
  return parseHtmlLinks(body, source);
}

async function main() {
  await mkdir(engineDir, { recursive: true });
  const sourcesDb = await readJson(sourcesPath, { sources: [] });
  const priorDb = await readJson(dbPath, { version: 1, items: [] });
  const logDb = await readJson(logPath, { version: 1, actions: [] });
  const found = [];
  const errors = [];

  for (const source of sourcesDb.sources || []) {
    try {
      const items = await scanSource(source);
      found.push(...items);
      logDb.actions.push({
        at: nowIso(),
        agent: "research-agent",
        action: "source_checked",
        sourceId: source.id,
        sourceName: source.name,
        found: items.length,
        result: "ok"
      });
    } catch (error) {
      errors.push({ sourceId: source.id, sourceName: source.name, error: error.message });
      logDb.actions.push({
        at: nowIso(),
        agent: "research-agent",
        action: "source_checked",
        sourceId: source.id,
        sourceName: source.name,
        found: 0,
        result: "error",
        error: error.message
      });
    }
  }

  const items = mergeItems(priorDb.items || [], found);
  await writeFile(dbPath, JSON.stringify({ version: 1, updated: nowIso(), items }, null, 2));
  try {
    await writeFile(logPath, JSON.stringify({ version: 1, updated: nowIso(), actions: logDb.actions.slice(-1000) }, null, 2));
  } catch (error) {
    errors.push({ sourceId: "actions-log", sourceName: "actions log write", error: error.message });
  }
  await publishAgentReport({
    agentId: "opportunity-research-agent",
    label: "Opportunity Research Agent",
    summary: "Public opportunity sources were rescanned and merged into the opportunity engine.",
    metrics: {
      sourcesChecked: (sourcesDb.sources || []).length,
      foundThisRun: found.length,
      totalItems: items.length,
      sourceErrors: errors.length
    },
    artifacts: [sourcesPath, dbPath, logPath],
    nextActions: [
      found.length ? `Pass ${found.length} discovered item(s) through review and quality gate.` : null,
      errors.length ? `Recheck ${errors.length} source(s) that errored on the next run.` : null
    ].filter(Boolean),
    focusAreas: ["public-source-research", "tender-discovery", "opportunity-engine-refresh"]
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourcesChecked: (sourcesDb.sources || []).length,
        foundThisRun: found.length,
        totalItems: items.length,
        errors
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
