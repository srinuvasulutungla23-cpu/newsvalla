import { useQuery } from "@tanstack/react-query";
import { fetchTopHeadlines, type Article } from "@/lib/news-api";

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
