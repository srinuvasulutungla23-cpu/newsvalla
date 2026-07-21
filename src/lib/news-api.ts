import { createServerFn } from "@tanstack/react-start";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Article = {
  id: string;
  category: string;
  image: string | null;
  headline: string;
  summary: string;
  source: string;
  time: string;
  readMin: number;
  url: string;
};

type NewsAPIArticle = {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
};

type NewsAPIResponse = {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
  code?: string;
  message?: string;
};

// NewsData.io response types
type NewsDataArticle = {
  article_id: string;
  title: string;
  description: string | null;
  content: string | null;
  link: string;
  image_url: string | null;
  source_name: string;
  pubDate: string | null;
  category: string[] | null;
  language: string;
};

type NewsDataResponse = {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage?: string;
  message?: string;
  code?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function estimateReadMin(text: string | null): number {
  if (!text) return 1;
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function mapToArticle(article: NewsAPIArticle, category: string): Article {
  return {
    id: `${article.source.name}-${article.publishedAt}-${article.title?.slice(0, 20)}`,
    category: category.toUpperCase(),
    image: article.urlToImage || null,
    headline: article.title,
    summary:
      article.description ||
      article.content?.replace(/\[\+\d+ chars\]/, "").slice(0, 200) ||
      "Tap to read the full article.",
    source: article.source.name.toUpperCase(),
    time: getRelativeTime(article.publishedAt),
    readMin: estimateReadMin(article.content || article.description),
    url: article.url,
  };
}

// ── Server Function ────────────────────────────────────────────────────────────
// Runs ONLY on the server (Nitro). The API key never reaches the browser.

export const fetchTopHeadlines = createServerFn({ method: "GET" })
  .validator((input: { category?: string; country?: string }) => input)
  .handler(async ({ data }) => {
    if (data?.category === "telugu") {
      try {
        const response = await fetch("https://telugu.way2news.com/");
        const html = await response.text();

        const newsItems: Article[] = [];
        const itemRegex = /<div class="newsItem">([\s\S]*?)<\/div>\s*<\/div>/gi;
        let match;
        let index = 0;
        while ((match = itemRegex.exec(html)) !== null) {
          const block = match[1];

          // Extract title & link
          const titleMatch = block.match(/<h1>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h1>/i);
          const link = titleMatch ? titleMatch[1] : "";
          const title = titleMatch ? titleMatch[2].trim() : "";

          // Extract image
          const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
          const image = imgMatch ? imgMatch[1] : null;

          // Extract description
          const descMatch = block.match(/<p>([\s\S]*?)<\/p>/i);
          const summary = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "";

          if (title && summary) {
            newsItems.push({
              id: `way2news-${index}-${title.slice(0, 15)}`,
              category: "TELUGU",
              image,
              headline: title,
              summary: summary,
              source: "WAY2NEWS",
              time: "Today",
              readMin: Math.max(1, Math.ceil(summary.split(/\s+/).length / 200)),
              url: link || "https://telugu.way2news.com/",
            });
            index++;
          }
        }
        return newsItems;
      } catch (err) {
        console.error("Failed to fetch or parse Way2News Telugu:", err);
        throw new Error("Failed to fetch Telugu news from Way2News");
      }
    }

    // Try both naming conventions for the env var
    const apiKey =
      process.env.NEWS_API_KEY ||
      process.env.VITE_NEWS_API_KEY;

    if (!apiKey) {
      throw new Error(
        "NEWS_API_KEY is not set. Add it to .env or your hosting platform's secrets."
      );
    }

    const url = new URL("https://newsapi.org/v2/top-headlines");
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("country", data?.country ?? "us");

    if (data?.category && data.category !== "general") {
      url.searchParams.set("category", data.category);
    }

    url.searchParams.set("pageSize", "20");

    const res = await fetch(url.toString());
    const json: NewsAPIResponse = await res.json();

    if (json.status !== "ok") {
      throw new Error(
        `NewsAPI error: ${json.message || json.code || "Unknown error"}`
      );
    }

    const articles = json.articles
      .filter(
        (a) =>
          a.title &&
          a.title !== "[Removed]" &&
          a.url &&
          a.url !== "https://removed.com"
      )
      .map((a) => mapToArticle(a, data?.category ?? "general"));

    return articles;
  });

// ── NewsData.io & Live Telugu Feed ──────────────────────────────────────────────
// Tries NewsData.io first. If Unauthorized (401) or failing, seamlessly falls back
// to live Google News Telugu RSS & Way2News so the Telugu feed NEVER breaks.

async function fetchTeluguGoogleNews(): Promise<Article[]> {
  const response = await fetch("https://news.google.com/rss?hl=te-IN&gl=IN&ceid=IN:te");
  const xml = await response.text();

  const newsItems: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let index = 0;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);

    const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "";
    const link = linkMatch ? linkMatch[1].trim() : "https://news.google.com";
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
    const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "TELUGU NEWS";

    if (rawTitle) {
      // Split title into headline and source if formatted as "Headline - Source"
      const titleParts = rawTitle.split(/\s+-\s+/);
      const headline = titleParts.length > 1 ? titleParts.slice(0, -1).join(" - ") : rawTitle;
      const displaySource = source !== "TELUGU NEWS" ? source : (titleParts[titleParts.length - 1] || "TELUGU NEWS");

      newsItems.push({
        id: `gnews-te-${index}-${headline.slice(0, 15)}`,
        category: "TELUGU",
        image: null,
        headline: headline,
        summary: `తెలుగు లైవ్ అప్‌డేట్: ${headline}. పూర్తి వివరాల కోసం ఆర్టికల్ చదవండి.`, // Telugu live summary
        source: displaySource.toUpperCase(),
        time: pubDate ? getRelativeTime(pubDate) : "Today",
        readMin: 1,
        url: link,
      });
      index++;
    }
  }

  return newsItems;
}

export const fetchTeluguNewsData = createServerFn({ method: "GET" })
  .validator((input: Record<string, never>) => input)
  .handler(async () => {
    const apiKey =
      process.env.VITE_NEWSDATA_API_KEY ||
      process.env.NEWSDATA_API_KEY;

    if (apiKey) {
      try {
        const url = new URL("https://newsdata.io/api/1/latest");
        url.searchParams.set("apikey", apiKey);
        url.searchParams.set("language", "te");
        url.searchParams.set("country", "in");
        url.searchParams.set("size", "10");

        const res = await fetch(url.toString());

        if (res.ok) {
          const json: NewsDataResponse = await res.json();
          if (json.status === "success" && json.results && json.results.length > 0) {
            return json.results
              .filter(
                (a) =>
                  a.title &&
                  a.title !== "[Removed]" &&
                  a.link &&
                  a.link !== "https://removed.com"
              )
              .map((a): Article => ({
                id: a.article_id || `nd-${a.source_name}-${a.title?.slice(0, 20)}`,
                category: "TELUGU",
                image: a.image_url || null,
                headline: a.title,
                summary:
                  a.description ||
                  a.content?.replace(/\[\+\d+ chars\]/, "").slice(0, 200) ||
                  "చదవడానికి ట్యాప్ చేయండి.",
                source: a.source_name?.toUpperCase() || "NEWSDATA",
                time: a.pubDate ? getRelativeTime(a.pubDate) : "Today",
                readMin: estimateReadMin(a.content || a.description),
                url: a.link,
              }));
          }
        }
        console.warn(`NewsData.io returned status ${res.status}. Falling back to Google News Telugu feed.`);
      } catch (err) {
        console.warn("NewsData.io fetch failed, falling back to Google News Telugu feed:", err);
      }
    }

    // Fallback to Google News Telugu RSS feed
    try {
      const liveItems = await fetchTeluguGoogleNews();
      if (liveItems.length > 0) return liveItems;
    } catch (err) {
      console.error("Google News Telugu RSS fallback failed:", err);
    }

    // Secondary fallback to Way2News
    return fetchTopHeadlines({ data: { category: "telugu" } });
  });


export const fetchAISummary = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      headline: string;
      summary: string;
      category?: string;
    }) => input
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Summarize the following news article into exactly 3 bullet points (Key Takeaway, Context/Background, Next Steps/Impact). Make it very clear, punchy, and modern. Output only the bullet points, no extra headers or introductory text.
                      Headline: ${data.headline}
                      Summary: ${data.summary}
                      Category: ${data.category || "General"}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 300,
              },
            }),
          }
        );

        const resJson = await response.json();
        const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const bullets = text
            .split("\n")
            .map((line: string) => line.replace(/^[\s*-•\d+.]*/, "").trim())
            .filter((line: string) => line.length > 0);

          if (bullets.length >= 3) {
            return {
              bullets: bullets.slice(0, 3),
              raw: text,
            };
          }
        }
      } catch (err) {
        console.error("Gemini API call failed, falling back to smart summary", err);
      }
    }

    // Fallback smart summary generator
    const { headline, summary } = data;
    const cleanedHeadline = headline.replace(/\s+-\s+[^:-]+$/, "");
    const bullets = [
      `Key Takeaway: ${cleanedHeadline}.`,
      `Context: ${summary.length > 120 ? summary.slice(0, 120) + "..." : summary}`,
      `Impact: Important developments in ${data.category?.toLowerCase() || "general"} topics. Tap the source link for the full report.`,
    ];

    return {
      bullets,
      raw: bullets.join("\n"),
    };
  });

