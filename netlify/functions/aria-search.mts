// Lightweight general-search helper for ARIA.
// Uses the DuckDuckGo Instant Answer API (public, no auth) to produce a short
// structured answer when possible. Falls back to a search-URL pointer so the
// client can always route users somewhere useful.

type Answer = {
  heading?: string;
  abstract?: string;
  abstractSource?: string;
  abstractUrl?: string;
  image?: string;
  related: { text: string; url: string }[];
  fallbackUrl: string;
};

export default async (req: Request) => {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") || "").trim();

  if (!query) {
    return Response.json({ error: "Missing q parameter" }, { status: 400 });
  }

  const fallbackUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  try {
    const api = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&no_redirect=1&skip_disambig=1&t=iisupport`;
    const res = await fetch(api, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ddg ${res.status}`);
    const data = (await res.json()) as {
      Heading?: string;
      AbstractText?: string;
      AbstractSource?: string;
      AbstractURL?: string;
      Image?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string; Topics?: unknown[] }[];
      Answer?: string;
      AnswerType?: string;
      Definition?: string;
      DefinitionSource?: string;
      DefinitionURL?: string;
    };

    const related: { text: string; url: string }[] = [];
    for (const t of data.RelatedTopics || []) {
      if (t.Text && t.FirstURL) {
        related.push({ text: t.Text, url: t.FirstURL });
        if (related.length >= 5) break;
      }
    }

    const abstract =
      data.AbstractText || data.Answer || data.Definition || "";
    const abstractSource =
      data.AbstractSource || data.DefinitionSource || undefined;
    const abstractUrl =
      data.AbstractURL || data.DefinitionURL || undefined;

    const payload: Answer = {
      heading: data.Heading || query,
      abstract: abstract || undefined,
      abstractSource,
      abstractUrl,
      image: data.Image ? `https://duckduckgo.com${data.Image}` : undefined,
      related,
      fallbackUrl,
    };

    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json({
      heading: query,
      related: [],
      fallbackUrl,
    } satisfies Answer);
  }
};
