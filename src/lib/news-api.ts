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
