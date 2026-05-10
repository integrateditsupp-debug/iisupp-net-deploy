import type { Context, Config } from "@netlify/functions";

const ARIA_SYSTEM_PROMPT = `You are ARIA, a real-time intelligent assistant for IISupport (iisupport.net).

Your role is to help users think, decide, and act clearly across any type of request.

GENERAL BEHAVIOR
- Understand intent, not just words.
- Keep responses simple, accurate, and useful.
- Do not overwhelm or over-explain.
- Adapt depth and style to the user.
- Speak naturally and clearly — never robotic, never scripted.

UNDERSTANDING
- If a request is unclear, incomplete, or ambiguous, ask one short clarification question instead of guessing.
- Do not guess when confidence is low.

DATA HANDLING — YOU HAVE LIVE WEB ACCESS
- You have a web_search tool. Use it whenever the answer depends on current information: news, prices, scores, weather, schedules, status, recent events, "today / now / latest / current", or anything time-sensitive. Don't ask permission — just search.
- A LIVE_CONTEXT block in the user message is real, current data. Quote it directly, including the timestamp.
- If you used web_search, briefly cite the source ("per Reuters, 2026-04-27") so the user knows it's live.
- Never claim data is live unless LIVE_CONTEXT confirms it or web_search just returned it.
- Never fabricate real-time accuracy.

NO EXTERNAL REDIRECTS
- Do not redirect users to external websites unless they explicitly ask.
- Always aim to provide the answer inside this experience.

RESPONSE STYLE — pick the format that makes the answer easiest to understand:
- Information → clear, direct explanation (use format "text").
- Actions or step-by-step fixes → numbered steps (use format "checklist", 3–6 steps max).
- Service / pricing summaries, stock quotes, weather snapshots, news cards → "card".
- Hands-on help is needed → "escalation" with phone (647) 581-3182.
- Avoid long paragraphs. Structure only when it improves clarity.

CONVERSATION FLOW
- After a helpful response, optionally add ONE short, natural follow-up suggestion in the next_step field — only if it adds real value.
- If the user changes direction, immediately follow the latest request.

SELF-SERVICE SUPPORT FLOW — follow this exact sequence on every request:
1. ASSESS the request. If it is unclear, ambiguous, or could mean multiple things, ask one short clarification question before doing anything else.
2. HELP DIRECTLY. Provide a direct answer or basic troubleshooting based on what you know or can fetch — this includes stock prices, account info, service status, weather, news, common technical problems (Wi-Fi, slow computer, email, printer, password reset, browser, phishing checks), pricing, and any other ARIA function listed on the site. Always attempt to solve in-chat first.
3. ADVANCE if step 2 doesn't resolve it. Offer deeper troubleshooting, alternate approaches, or describe an escalation path — but still keep the conversation in chat.

WHEN TO PROVIDE THE CONTACT NUMBER (escalate=true, format="escalation", phone=(647) 581-3182):
- Only when the user EXPLICITLY asks for human support, an agent, a person, a callback, or a phone number.
- Or when the issue is CLEARLY beyond self-service — hardware failure, on-site visit needed, physical damage, dead/unresponsive device after the user has tried fixes, or sensitive account changes (billing disputes, account ownership, password recovery for a locked account, identity verification).
- Use this exact line in those cases: "If this is urgent or you require on-site or live agent assistance, please contact the number below."

NEVER skip to the contact number without trying to help first. Do not offer the phone reflexively just because a question is technical. A user asking "my Wi-Fi is slow" gets troubleshooting, not a phone number. A user asking "can someone come fix my server" gets the phone number.

GENERAL SUPPORT RULES
- Never invent prices, hours, guarantees, or services that were not stated.
- Never claim to be human. You are ARIA.

PRIORITY: Understand → Solve → Deliver → Offer next step.

OUTPUT CONTRACT — your final assistant message must be a single JSON object only. No prose before or after, no markdown fences. Shape:

{
  "intent": "troubleshoot" | "pricing" | "service" | "escalation" | "stock" | "weather" | "news" | "general",
  "response": "<plain-text reply, no markdown>",
  "format": "text" | "checklist" | "card" | "escalation",
  "escalate": true | false,
  "phone": "(647) 581-3182",
  "next_step": "<one short suggested next action, plain text, may be empty>"
}

When format is "checklist", "response" must contain numbered steps separated by newlines (e.g. "1. ...\\n2. ...\\n3. ...").
When format is "card" for a stock quote, "response" should read like a compact line — e.g. "TSLA · $245.12 (+1.85, +0.76%) · Nasdaq · as of 14:31 ET".`;

interface AriaRequestBody {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface AriaJsonResponse {
  intent: string;
  response: string;
  format: string;
  escalate: boolean;
  phone: string;
  next_step: string;
}

const FALLBACK_PHONE = "(647) 581-3182";

const STOCK_HINT = /\b(stock|stocks|share price|share prices|ticker|quote|nasdaq|nyse|dow|s&p|sp500|s\&p\s?500)\b/i;

const YH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; IISupport-ARIA/1.0; +https://iisupport.net)",
  Accept: "application/json",
};

function safeJsonExtract(text: string): AriaJsonResponse | null {
  if (!text) return null;
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(trimmed.slice(start, end + 1));
    if (typeof obj !== "object" || obj === null) return null;
    return {
      intent: typeof obj.intent === "string" ? obj.intent : "general",
      response: typeof obj.response === "string" ? obj.response : "",
      format: typeof obj.format === "string" ? obj.format : "text",
      escalate: Boolean(obj.escalate),
      phone: typeof obj.phone === "string" ? obj.phone : FALLBACK_PHONE,
      next_step: typeof obj.next_step === "string" ? obj.next_step : "",
    };
  } catch {
    return null;
  }
}

function extractStockQuery(message: string): string | null {
  if (!message) return null;
  if (!STOCK_HINT.test(message) && !/^[A-Z]{1,5}$/.test(message.trim())) {
    return null;
  }
  const cleaned = message
    .replace(/\b(stock|stocks|share|shares|price|prices|ticker|quote|today|now|please|live|current|the)\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    const m = message.match(/\b[A-Z]{1,5}\b/);
    return m ? m[0] : null;
  }
  return cleaned.slice(0, 60);
}

type Quote = {
  ok: boolean;
  symbol: string | null;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string | null;
};

async function resolveSymbol(q: string): Promise<{ symbol: string; name?: string; exchange?: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, { headers: YH_HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }>;
    };
    const list = json.quotes || [];
    const equity =
      list.find((x) => x.quoteType === "EQUITY" && x.symbol) ||
      list.find((x) => x.symbol);
    if (!equity || !equity.symbol) return null;
    return { symbol: equity.symbol.toUpperCase(), name: equity.longname || equity.shortname, exchange: equity.exchange };
  } catch {
    return null;
  }
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, { headers: YH_HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
    };
    const m = (json.chart?.result?.[0]?.meta || {}) as Record<string, unknown>;
    const price = typeof m.regularMarketPrice === "number" ? (m.regularMarketPrice as number) : null;
    const prev =
      typeof m.previousClose === "number"
        ? (m.previousClose as number)
        : typeof m.chartPreviousClose === "number"
        ? (m.chartPreviousClose as number)
        : null;
    const change = price !== null && prev !== null ? price - prev : null;
    const changePercent = change !== null && prev ? (change / prev) * 100 : null;
    const asOf =
      typeof m.regularMarketTime === "number"
        ? new Date((m.regularMarketTime as number) * 1000).toISOString()
        : null;
    return {
      ok: price !== null,
      symbol: ((m.symbol as string) || symbol).toUpperCase(),
      name: ((m.longName as string) || (m.shortName as string) || null),
      exchange: (m.exchangeName as string) || null,
      currency: (m.currency as string) || null,
      price,
      change,
      changePercent,
      asOf,
    };
  } catch {
    return null;
  }
}

async function buildLiveContext(message: string): Promise<string | null> {
  const stockQuery = extractStockQuery(message);
  if (!stockQuery) return null;

  const isLikelyTicker = /^[A-Z]{1,5}$/.test(stockQuery);
  let symbolInfo: { symbol: string; name?: string; exchange?: string } | null = null;
  if (isLikelyTicker) {
    symbolInfo = { symbol: stockQuery };
  } else {
    symbolInfo = await resolveSymbol(stockQuery);
  }
  if (!symbolInfo) return null;

  const quote = await fetchQuote(symbolInfo.symbol);
  if (!quote || !quote.ok || quote.price === null) return null;

  const fmt = (n: number | null, d = 2) =>
    n === null ? "n/a" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sign = (n: number | null) => (n === null ? "" : n >= 0 ? "+" : "");
  const lines = [
    `kind: stock_quote`,
    `symbol: ${quote.symbol}`,
    `name: ${quote.name || symbolInfo.name || "n/a"}`,
    `exchange: ${quote.exchange || symbolInfo.exchange || "n/a"}`,
    `currency: ${quote.currency || "USD"}`,
    `price: ${fmt(quote.price)}`,
    `change: ${sign(quote.change)}${fmt(quote.change)}`,
    `change_percent: ${sign(quote.changePercent)}${fmt(quote.changePercent)}%`,
    `as_of: ${quote.asOf || "n/a"}`,
    `source: Yahoo Finance`,
  ];
  return lines.join("\n");
}

type AnthropicContentBlock =
  | { type: "text"; text?: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "server_tool_use"; id: string; name: string; input: unknown }
  | { type: "web_search_tool_result"; tool_use_id: string; content: unknown }
  | { type: string; [k: string]: unknown };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

async function callAnthropic(
  apiKey: string,
  messages: AnthropicMessage[]
): Promise<{ ok: true; data: { content?: AnthropicContentBlock[]; stop_reason?: string } } | { ok: false; status: number; body: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: ARIA_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ],
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body };
  }
  const data = (await res.json()) as { content?: AnthropicContentBlock[]; stop_reason?: string };
  return { ok: true, data };
}

function extractFinalText(blocks: AnthropicContentBlock[] | undefined): string {
  if (!blocks) return "";
  return blocks
    .filter((b) => b.type === "text" && typeof (b as { text?: string }).text === "string")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
}

const COMPLEX_FALLBACK: AriaJsonResponse = {
  intent: "escalation",
  response:
    "If this is urgent or you require on-site or live agent assistance, please contact the number below.",
  format: "escalation",
  escalate: true,
  phone: FALLBACK_PHONE,
  next_step: `Call ${FALLBACK_PHONE}`,
};

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json(COMPLEX_FALLBACK satisfies AriaJsonResponse, { status: 200 });
  }

  let body: AriaRequestBody;
  try {
    body = (await req.json()) as AriaRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message) {
    return Response.json({ error: "Missing 'message'" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

  let liveContext: string | null = null;
  try {
    liveContext = await buildLiveContext(message);
  } catch {
    liveContext = null;
  }

  const userContent = liveContext
    ? `LIVE_CONTEXT (real, current data — quote it):\n${liveContext}\n\nUSER_MESSAGE:\n${message}`
    : message;

  const messages: AnthropicMessage[] = [
    ...history
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }) as AnthropicMessage),
    { role: "user", content: userContent.slice(0, 6000) },
  ];

  try {
    let result = await callAnthropic(apiKey, messages);
    if (!result.ok) {
      console.error("Anthropic API error", result.status, result.body.slice(0, 300));
      return Response.json(COMPLEX_FALLBACK satisfies AriaJsonResponse, { status: 200 });
    }

    let workingMessages = messages;
    let hops = 0;
    while (result.ok && result.data.stop_reason === "pause_turn" && hops < 3) {
      hops += 1;
      workingMessages = [
        ...workingMessages,
        { role: "assistant", content: result.data.content || [] },
      ];
      result = await callAnthropic(apiKey, workingMessages);
      if (!result.ok) {
        console.error("Anthropic API error (resume)", result.status, result.body.slice(0, 300));
        return Response.json(COMPLEX_FALLBACK satisfies AriaJsonResponse, { status: 200 });
      }
    }

    const text = extractFinalText(result.data.content);
    const parsed = safeJsonExtract(text);
    const payload: AriaJsonResponse = parsed || {
      intent: "general",
      response: text || COMPLEX_FALLBACK.response,
      format: text ? "text" : "escalation",
      escalate: !text,
      phone: FALLBACK_PHONE,
      next_step: text ? "" : `Call ${FALLBACK_PHONE}`,
    };

    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("aria function error", err);
    return Response.json(COMPLEX_FALLBACK satisfies AriaJsonResponse, { status: 200 });
  }
};

export const config: Config = {
  path: "/api/aria",
};
