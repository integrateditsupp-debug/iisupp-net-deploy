// Aggregates free, public market news from reliable sources:
//   - Yahoo Finance RSS (no auth, equity news)
//   - CoinGecko public status / trending (no auth, crypto)
//   - SEC EDGAR atom feed (no auth, US regulatory filings)
//
// Returns a normalized list of {title, summary, url, source, image?, timestamp}.
// All sources are public RSS/Atom/JSON — no API key is required.

type NewsItem = {
  title: string;
  summary: string;
  url: string;
  source: string;
  image?: string;
  timestamp?: string;
};

export default async (req: Request) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";

  const [yahoo, coin, edgar] = await Promise.allSettled([
    fetchYahoo(query),
    fetchCoinGecko(query),
    fetchSecEdgar(query),
  ]);

  const items: NewsItem[] = [];
  if (yahoo.status === "fulfilled") items.push(...yahoo.value);
  if (coin.status === "fulfilled") items.push(...coin.value);
  if (edgar.status === "fulfilled") items.push(...edgar.value);

  items.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });

  return Response.json(
    { items: items.slice(0, 12) },
    {
      headers: {
        "Cache-Control": "public, max-age=180, stale-while-revalidate=600",
      },
    }
  );
};

async function fetchYahoo(query: string): Promise<NewsItem[]> {
  const symbol = extractSymbol(query) || "^GSPC";
  const feed = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  try {
    const res = await fetch(feed, {
      headers: { "User-Agent": "iisupport.net/1.0 (+https://iisupport.net)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, "Yahoo Finance").slice(0, 6);
  } catch {
    return [];
  }
}

async function fetchCoinGecko(_query: string): Promise<NewsItem[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      coins?: { item?: { id?: string; name?: string; symbol?: string; small?: string; slug?: string; market_cap_rank?: number } }[];
    };
    const now = new Date().toISOString();
    return (data.coins || []).slice(0, 6).map((c) => {
      const item = c.item || {};
      return {
        title: `Trending: ${item.name || item.symbol || "Unknown"}  (${(item.symbol || "").toUpperCase()})`,
        summary: `Rank ${item.market_cap_rank ?? "?"} — currently trending on CoinGecko.`,
        url: `https://www.coingecko.com/en/coins/${item.id || item.slug || ""}`,
        source: "CoinGecko",
        image: item.small,
        timestamp: now,
      };
    });
  } catch {
    return [];
  }
}

async function fetchSecEdgar(_query: string): Promise<NewsItem[]> {
  const feed =
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&datea=&dateb=&owner=include&count=10&output=atom";
  try {
    const res = await fetch(feed, {
      headers: {
        "User-Agent": "iisupport.net contact@iisupport.net",
        Accept: "application/atom+xml",
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseAtom(xml, "SEC EDGAR (8-K)").slice(0, 4);
  } catch {
    return [];
  }
}

function extractSymbol(q: string): string | null {
  const m = q.match(/\b([A-Z]{1,5})\b/);
  return m ? m[1] : null;
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    items.push({
      title: decodeHtml(extractTag(block, "title")),
      summary: trimText(stripHtml(decodeHtml(extractTag(block, "description"))), 220),
      url: extractTag(block, "link"),
      source,
      timestamp: extractTag(block, "pubDate") || new Date().toISOString(),
    });
  }
  return items;
}

function parseAtom(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
    items.push({
      title: decodeHtml(extractTag(block, "title")),
      summary: trimText(stripHtml(decodeHtml(extractTag(block, "summary") || extractTag(block, "content"))), 200),
      url: linkMatch ? linkMatch[1] : "",
      source,
      timestamp: extractTag(block, "updated") || extractTag(block, "published") || new Date().toISOString(),
    });
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function trimText(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
