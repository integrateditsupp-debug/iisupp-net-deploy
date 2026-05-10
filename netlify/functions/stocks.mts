import type { Context, Config } from "@netlify/functions";

// Live stocks endpoint — uses Yahoo Finance public endpoints (no API key required).
// Accepts either ?symbol=TSLA or ?q=tesla. When only q is provided, the function
// resolves the most relevant equity ticker via Yahoo's search API, then fetches
// the most recent quote via the chart endpoint.

type StockPayload = {
  ok: boolean;
  source: string;
  symbol: string | null;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string | null;
  message?: string;
};

const YH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; IISupport-ARIA/1.0; +https://iisupport.net)",
  Accept: "application/json",
};

async function resolveSymbol(q: string): Promise<{
  symbol: string;
  name?: string;
  exchange?: string;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, { headers: YH_HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        quoteType?: string;
      }>;
    };
    const list = json.quotes || [];
    const equity =
      list.find((x) => x.quoteType === "EQUITY" && x.symbol) ||
      list.find((x) => x.symbol);
    if (!equity || !equity.symbol) return null;
    return {
      symbol: equity.symbol.toUpperCase(),
      name: equity.longname || equity.shortname,
      exchange: equity.exchange,
    };
  } catch {
    return null;
  }
}

async function fetchQuote(symbol: string): Promise<StockPayload> {
  const empty: StockPayload = {
    ok: false,
    source: "yahoo-finance",
    symbol,
    name: null,
    exchange: null,
    currency: null,
    price: null,
    previousClose: null,
    change: null,
    changePercent: null,
    asOf: null,
  };

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=5d`;
    const res = await fetch(url, { headers: YH_HEADERS });
    if (!res.ok) {
      return { ...empty, message: `Upstream ${res.status}` };
    }
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            symbol?: string;
            currency?: string;
            exchangeName?: string;
            longName?: string;
            shortName?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketTime?: number;
          };
        }>;
        error?: { description?: string } | null;
      };
    };
    const r = json.chart?.result?.[0];
    if (!r || !r.meta) return { ...empty, message: "No quote available" };
    const m = r.meta;
    const price = typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : null;
    const prev =
      typeof m.previousClose === "number"
        ? m.previousClose
        : typeof m.chartPreviousClose === "number"
        ? m.chartPreviousClose
        : null;
    const change = price !== null && prev !== null ? price - prev : null;
    const changePercent =
      change !== null && prev ? (change / prev) * 100 : null;
    const asOf = m.regularMarketTime
      ? new Date(m.regularMarketTime * 1000).toISOString()
      : null;
    return {
      ok: price !== null,
      source: "yahoo-finance",
      symbol: (m.symbol || symbol).toUpperCase(),
      name: m.longName || m.shortName || null,
      exchange: m.exchangeName || null,
      currency: m.currency || null,
      price,
      previousClose: prev,
      change,
      changePercent,
      asOf,
    };
  } catch (err) {
    return { ...empty, message: (err as Error).message || "fetch failed" };
  }
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const symbolParam = (url.searchParams.get("symbol") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();

  let symbol = symbolParam.toUpperCase().slice(0, 12);
  let resolvedName: string | null = null;
  let resolvedExchange: string | null = null;

  if (!symbol && q) {
    const resolved = await resolveSymbol(q);
    if (resolved) {
      symbol = resolved.symbol;
      resolvedName = resolved.name || null;
      resolvedExchange = resolved.exchange || null;
    }
  }

  if (!symbol) {
    return Response.json(
      {
        ok: false,
        source: "yahoo-finance",
        symbol: null,
        message: "Provide ?symbol=TSLA or ?q=<company name>",
      },
      { status: 400 }
    );
  }

  const quote = await fetchQuote(symbol);
  if (!quote.name && resolvedName) quote.name = resolvedName;
  if (!quote.exchange && resolvedExchange) quote.exchange = resolvedExchange;

  return Response.json(quote, {
    headers: {
      "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
    },
  });
};

export const config: Config = {
  path: "/api/stocks",
};
