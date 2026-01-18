import { parseFeed } from "feedsmith";
import type { FeedInfo } from "./opml.ts";

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date | null;
  feedTitle: string;
  category: string;
}

export interface DateFilter {
  since?: Date;
  until?: Date;
}

interface ParsedItem {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
  date_published?: string;
}

interface ParsedFeed {
  title?: string;
  items?: ParsedItem[];
}

const FETCH_TIMEOUT = 30000; // 30 seconds

async function fetchWithTimeout(
  url: string,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "smart-rss/1.0",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function isWithinDateRange(pubDate: Date | null, filter: DateFilter): boolean {
  if (!pubDate) return true; // Include items without dates

  if (filter.since && pubDate < filter.since) return false;
  if (filter.until && pubDate > filter.until) return false;

  return true;
}

function extractItems(result: ReturnType<typeof parseFeed>): ParsedItem[] {
  if (!result) return [];

  // Handle different feed formats
  const feed = result.feed as ParsedFeed;
  return (feed.items || []) as ParsedItem[];
}

function extractTitle(result: ReturnType<typeof parseFeed>): string {
  if (!result) return "";
  const feed = result.feed as ParsedFeed;
  return feed.title || "";
}

export async function fetchFeed(
  feedInfo: FeedInfo,
  dateFilter: DateFilter = {}
): Promise<FeedItem[]> {
  try {
    const response = await fetchWithTimeout(feedInfo.url, FETCH_TIMEOUT);

    if (!response.ok) {
      console.error(`Failed to fetch ${feedInfo.url}: HTTP ${response.status}`);
      return [];
    }

    const content = await response.text();
    const result = parseFeed(content);

    if (!result) {
      console.error(`Failed to parse feed from ${feedInfo.url}`);
      return [];
    }

    const items: FeedItem[] = [];
    const feedItems = extractItems(result);
    const feedTitle = extractTitle(result);

    for (const item of feedItems) {
      // Try different date fields for different feed formats
      const dateStr = item.pubDate || item.published || item.updated || item.date_published;
      const pubDate = parseDate(dateStr);

      if (!isWithinDateRange(pubDate, dateFilter)) {
        continue;
      }

      // Get content from various possible fields
      const description = item.description || item.content || "";

      items.push({
        title: item.title || "Untitled",
        link: item.link || "",
        description: typeof description === "string" ? description : "",
        pubDate,
        feedTitle: feedTitle || feedInfo.title,
        category: feedInfo.category,
      });
    }

    return items;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`Timeout fetching ${feedInfo.url}`);
    } else {
      console.error(`Error fetching ${feedInfo.url}:`, error);
    }
    return [];
  }
}

export async function fetchAllFeeds(
  feeds: FeedInfo[],
  dateFilter: DateFilter = {},
  onProgress?: (completed: number, total: number) => void
): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    feeds.map(async (feed, index) => {
      const items = await fetchFeed(feed, dateFilter);
      onProgress?.(index + 1, feeds.length);
      return items;
    })
  );

  const allItems: FeedItem[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  return allItems;
}
