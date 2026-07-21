import { useQuery } from "@tanstack/react-query";
import { fetchTopHeadlines, fetchTeluguNewsData, type Article } from "@/lib/news-api";

/**
 * React Query hook that fetches live news from NewsAPI via our server function.
 *
 * - 5 minute staleTime to conserve the free-tier 100 req/day limit
 * - Disabled refetch-on-focus so switching tabs doesn't burn requests
 */
export function useNews(category?: string) {
  return useQuery<Article[]>({
    queryKey: ["news", category ?? "general"],
    queryFn: () => fetchTopHeadlines({ data: { category } }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * React Query hook that fetches live Telugu news from NewsData.io.
 *
 * - language=te&country=in for authentic Telugu content
 * - 10 minute staleTime — double the general feed — to stay well within
 *   the free-tier 200 req/day cap
 * - Results are cached client-side by React Query; the cache key is stable
 *   so navigating away and back reuses the cached response
 */
export function useTeluguNews() {
  return useQuery<Article[]>({
    queryKey: ["news", "telugu-newsdata"],
    queryFn: () => fetchTeluguNewsData({ data: {} }),
    staleTime: 10 * 60 * 1000, // 10 minutes — conserve free-tier quota
    gcTime: 30 * 60 * 1000,    // keep cached for 30 minutes after last use
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
